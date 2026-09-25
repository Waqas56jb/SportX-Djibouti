import { beforeEach, describe, expect, it } from 'vitest';
import { address, api, auth, createProduct, createStaff, putInCart, registerCustomer, resetData, stockOf } from '../helpers/fixtures.js';
import { query, queryOne } from '../../src/config/database.js';

async function placeOrder(token: string, body: Record<string, unknown> = {}, key?: string) {
  const req = api().post('/api/v1/orders').set(auth(token));
  if (key) req.set('Idempotency-Key', key);
  return req.send({ shippingMethod: 'standard', paymentMethod: 'CASH_ON_DELIVERY', address, ...body });
}

describe('checkout and order creation', () => {
  beforeEach(resetData);

  it('prices on the server, reserves stock, snapshots items and clears the cart', async () => {
    const p = await createProduct({ price: 12000, stock: 5 });
    const c = await registerCustomer();
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 2 }]);
    // Tamper with the cart's price snapshot — the server must ignore it.
    await query(`update public.cart_items set unit_price_snapshot = 1`);

    const res = await placeOrder(c.token);
    expect(res.status).toBe(201);
    const o = res.body.data;
    expect(o.orderNumber).toMatch(/^SPX-\d{4}-000001$/);
    expect(o.status).toBe('PENDING');
    expect(o.totals.subtotal).toBe(24000);
    expect(o.totals.shipping).toBe(1000); // below the 25 000 free-shipping threshold
    expect(o.totals.grandTotal).toBe(25000);
    expect(o.items[0]).toMatchObject({ sku: p.variants[0].sku, quantity: 2, unitPrice: 12000, color: 'Black', size: '41' });
    expect(o.timeline[0].status).toBe('PENDING');

    expect(await stockOf(p.variants[0].id)).toEqual({ stock_quantity: 5, reserved_quantity: 2 });
    const cart = await queryOne<{ n: number }>(`select count(*)::int as n from public.cart_items`);
    expect(cart!.n).toBe(0);

    // Snapshot survives product edits.
    await query(`update public.products set name = 'Renamed', price = 1 where id = $1`, [p.productId]);
    const again = await api().get(`/api/v1/orders/${o.id}`).set(auth(c.token));
    expect(again.body.data.items[0].productName).not.toBe('Renamed');
    expect(again.body.data.items[0].unitPrice).toBe(12000);
  });

  it('applies free shipping at the threshold and rejects an empty cart', async () => {
    const p = await createProduct({ price: 25000 });
    const c = await registerCustomer();
    expect((await placeOrder(c.token)).body.error.code).toBe('ORDER_INVALID');
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    const res = await placeOrder(c.token);
    expect(res.body.data.totals.shipping).toBe(0);
    expect(res.body.data.totals.grandTotal).toBe(25000);
  });

  it('never sells the last unit twice', async () => {
    const p = await createProduct({ stock: 1 });
    const a = await registerCustomer();
    const b = await registerCustomer();
    await putInCart(a.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    await putInCart(b.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    const [ra, rb] = await Promise.all([placeOrder(a.token), placeOrder(b.token)]);
    const statuses = [ra.status, rb.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect([ra.body, rb.body].find((x) => !x.success).error.code).toBe('OUT_OF_STOCK');
    expect(await stockOf(p.variants[0].id)).toEqual({ stock_quantity: 1, reserved_quantity: 1 });
    const orders = await queryOne<{ n: number }>(`select count(*)::int as n from public.orders`);
    expect(orders!.n).toBe(1);
  });

  it('refuses inactive products and draft products', async () => {
    const draft = await createProduct({ status: 'DRAFT' });
    const c = await registerCustomer();
    await putInCart(c.user.id, [{ variantId: draft.variants[0].id, quantity: 1 }]);
    const res = await placeOrder(c.token);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ORDER_INVALID');
  });

  it('is idempotent: the same Idempotency-Key never creates a second order', async () => {
    const p = await createProduct();
    const c = await registerCustomer();
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    const first = await placeOrder(c.token, {}, 'checkout-key-12345');
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    const second = await placeOrder(c.token, {}, 'checkout-key-12345');
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.orders`))!.n).toBe(1);
  });

  it('validates coupons server-side: minimum order, expiry and usage limits', async () => {
    const p = await createProduct({ price: 10000 });
    await query(`insert into public.coupons (code, type, value, minimum_order_amount, usage_limit) values ('SAVE10', 'PERCENTAGE', 10, 15000, 1)`);
    await query(`insert into public.coupons (code, type, value, starts_at, ends_at) values ('OLD', 'FIXED', 500, now() - interval '10 days', now() - interval '1 day')`);
    const c = await registerCustomer();
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    const low = await placeOrder(c.token, { couponCode: 'SAVE10' });
    expect(low.body.error.code).toBe('INVALID_COUPON');
    expect((await placeOrder(c.token, { couponCode: 'OLD' })).body.error.message).toMatch(/expired/);

    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 2 }]);
    const ok = await placeOrder(c.token, { couponCode: 'save10' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.totals.couponDiscount).toBe(2000);
    expect(ok.body.data.totals.grandTotal).toBe(20000 - 2000 + 1000);

    const d = await registerCustomer();
    await putInCart(d.user.id, [{ variantId: p.variants[1].id, quantity: 2 }]);
    const exhausted = await placeOrder(d.token, { couponCode: 'SAVE10' });
    expect(exhausted.body.error.code).toBe('INVALID_COUPON');
    expect(exhausted.body.error.message).toMatch(/usage limit/);
  });

  it('applies the best automatic discount once per unit', async () => {
    const p = await createProduct({ price: 20000 });
    await query(`insert into public.discounts (name, type, value, applies_to, target_ids) values ('10% boots', 'PERCENTAGE', 10, 'PRODUCTS', array[$1::uuid]), ('Sitewide 1000', 'FIXED', 1000, 'ALL', '{}')`, [p.productId]);
    const c = await registerCustomer();
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    const res = await api().post('/api/v1/checkout/validate').set(auth(c.token)).send({ shippingMethod: 'pickup' });
    expect(res.status).toBe(200);
    expect(res.body.data.lines[0].unitPrice).toBe(18000);
    expect(res.body.data.totals.productDiscount).toBe(2000);
    expect(res.body.data.totals.shipping).toBe(0);
    expect(res.body.data.valid).toBe(true);
  });
});

describe('order ownership and lifecycle', () => {
  beforeEach(resetData);

  it('never exposes another customer’s order', async () => {
    const p = await createProduct();
    const owner = await registerCustomer();
    const other = await registerCustomer();
    await putInCart(owner.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    const order = (await placeOrder(owner.token)).body.data;
    expect((await api().get(`/api/v1/orders/${order.id}`).set(auth(other.token))).status).toBe(404);
    expect((await api().post(`/api/v1/orders/${order.id}/cancel`).set(auth(other.token)).send({})).status).toBe(404);
    expect((await api().get('/api/v1/orders').set(auth(other.token))).body.data).toHaveLength(0);
    expect((await api().get(`/api/v1/orders/${order.id}`)).status).toBe(401);
  });

  it('runs COD fulfilment end-to-end: stock committed on shipment, paid on delivery', async () => {
    const p = await createProduct({ stock: 4 });
    const c = await registerCustomer();
    const staff = await createStaff('ORDER_MANAGER');
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 2 }]);
    const order = (await placeOrder(c.token)).body.data;

    const set = (status: string) => api().patch(`/api/v1/admin/orders/${order.id}/status`).set(auth(staff.token)).send({ status });
    expect((await set('DELIVERED')).body.error.code).toBe('ORDER_INVALID'); // cannot skip steps
    expect((await set('PROCESSING')).status).toBe(200);
    expect((await set('PACKED')).status).toBe(200);
    expect(await stockOf(p.variants[0].id)).toEqual({ stock_quantity: 4, reserved_quantity: 2 });
    const shipped = await set('SHIPPED');
    expect(shipped.body.data.shipping.status).toBe('SHIPPED');
    expect(await stockOf(p.variants[0].id)).toEqual({ stock_quantity: 2, reserved_quantity: 0 });
    const delivered = await set('DELIVERED');
    expect(delivered.body.data.paymentStatus).toBe('PAID');
    expect(delivered.body.data.timeline.map((t: { status: string }) => t.status)).toEqual(['PENDING', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']);
    expect((await set('CANCELLED')).body.error.code).toBe('ORDER_INVALID'); // delivered orders cannot be cancelled

    const movement = await queryOne<{ reason: string; change: number }>(`select reason, change from public.inventory_movements where order_id = $1`, [order.id]);
    expect(movement).toEqual({ reason: 'ORDER', change: -2 });
    const notes = await query<{ type: string }>(`select type from public.notifications where user_id = $1 order by created_at`, [c.user.id]);
    expect(notes.map((n) => n.type)).toEqual(expect.arrayContaining(['ORDER_CREATED', 'ORDER_PROCESSING', 'ORDER_SHIPPED', 'ORDER_DELIVERED']));
  });

  it('lets a customer cancel before preparation and releases the reservation', async () => {
    const p = await createProduct({ stock: 3 });
    const c = await registerCustomer();
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 3 }]);
    const order = (await placeOrder(c.token)).body.data;
    expect(await stockOf(p.variants[0].id)).toEqual({ stock_quantity: 3, reserved_quantity: 3 });
    const res = await api().post(`/api/v1/orders/${order.id}/cancel`).set(auth(c.token)).send({ reason: 'Changed my mind' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    expect(await stockOf(p.variants[0].id)).toEqual({ stock_quantity: 3, reserved_quantity: 0 });
    expect((await api().post(`/api/v1/orders/${order.id}/cancel`).set(auth(c.token)).send({})).status).toBe(422);
  });
});

describe('online payments', () => {
  beforeEach(resetData);

  async function cardOrder() {
    const p = await createProduct({ price: 30000, stock: 2 });
    const c = await registerCustomer();
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    const order = (await placeOrder(c.token, { paymentMethod: 'CARD' })).body.data;
    return { p, c, order };
  }

  it('only a verified webhook marks the order paid, and repeated deliveries are processed once', async () => {
    const { p, c, order } = await cardOrder();
    expect(order.status).toBe('PAYMENT_PENDING');
    expect(order.paymentExpiresAt).toBeTruthy();

    const created = await api().post('/api/v1/payments/create').set(auth(c.token)).send({ orderId: order.id });
    expect(created.status).toBe(201);
    expect(created.body.data.clientSecret).toMatch(/^mock_pi_/);
    const paymentId = created.body.data.payment.id;

    // A forged webhook without a valid signature is rejected.
    const forged = await api().post('/api/v1/payments/webhook/mock').set('Content-Type', 'application/json').send({ id: 'evt_x', type: 'payment.succeeded', data: { paymentId } });
    expect(forged.status).toBe(400);
    expect((await api().get(`/api/v1/orders/${order.id}`).set(auth(c.token))).body.data.paymentStatus).toBe('PENDING');

    const done = await api().post(`/api/v1/payments/${paymentId}/mock-complete`).set(auth(c.token)).send({ outcome: 'succeeded', last4: '4242' });
    expect(done.body.data.outcome).toBe('processed');

    const { signMockPayload, SIGNATURE_HEADER } = await import('../../src/services/payment/providers/mock.provider.js');
    const evt = await queryOne<{ payload: Record<string, unknown> }>(`select payload from public.payment_events where type = 'payment.succeeded'`);
    const raw = JSON.stringify(evt!.payload);
    const replay = await api().post('/api/v1/payments/webhook/mock').set('Content-Type', 'application/json').set(SIGNATURE_HEADER, signMockPayload(raw)).send(raw);
    expect(replay.status).toBe(200);
    expect(replay.body.data.outcome).toBe('duplicate');

    const after = (await api().get(`/api/v1/orders/${order.id}`).set(auth(c.token))).body.data;
    expect(after.status).toBe('PAYMENT_CONFIRMED');
    expect(after.paymentStatus).toBe('PAID');
    expect(after.payment.cardLast4).toBe('4242');
    expect(await stockOf(p.variants[0].id)).toEqual({ stock_quantity: 1, reserved_quantity: 0 });
    const history = await query(`select status from public.order_status_history where order_id = $1 and status = 'PAYMENT_CONFIRMED'`, [order.id]);
    expect(history).toHaveLength(1);
  });

  it('keeps a failed payment unpaid and retryable, and admins cannot mark card payments paid', async () => {
    const { c, order } = await cardOrder();
    const staff = await createStaff('SUPER_ADMIN');
    const pay = (await api().post('/api/v1/payments/create').set(auth(c.token)).send({ orderId: order.id })).body.data;
    await api().post(`/api/v1/payments/${pay.payment.id}/mock-complete`).set(auth(c.token)).send({ outcome: 'failed' });
    const o = (await api().get(`/api/v1/orders/${order.id}`).set(auth(c.token))).body.data;
    expect(o.status).toBe('PAYMENT_PENDING');
    expect(o.paymentStatus).toBe('FAILED');
    const manual = await api().patch(`/api/v1/admin/orders/${order.id}/payment-status`).set(auth(staff.token)).send({ status: 'PAID' });
    expect(manual.status).toBe(403);
    const retry = await api().post('/api/v1/payments/create').set(auth(c.token)).send({ orderId: order.id });
    expect(retry.status).toBe(201);
    expect(retry.body.data.payment.id).not.toBe(pay.payment.id);
  });

  it('refunds through the provider, restocks, and refuses to refund twice', async () => {
    const { p, c, order } = await cardOrder();
    const staff = await createStaff('SUPER_ADMIN');
    const pay = (await api().post('/api/v1/payments/create').set(auth(c.token)).send({ orderId: order.id })).body.data;
    await api().post(`/api/v1/payments/${pay.payment.id}/mock-complete`).set(auth(c.token)).send({ outcome: 'succeeded' });

    const partial = await api().post(`/api/v1/admin/orders/${order.id}/refund`).set(auth(staff.token)).send({ type: 'partial', amount: 5000, reason: 'DAMAGED_ITEM' });
    expect(partial.status).toBe(200);
    expect(partial.body.data.order.paymentStatus).toBe('PARTIALLY_REFUNDED');
    const tooMuch = await api().post(`/api/v1/admin/orders/${order.id}/refund`).set(auth(staff.token)).send({ type: 'partial', amount: 999999, reason: 'OTHER' });
    expect(tooMuch.status).toBe(400);

    const full = await api().post(`/api/v1/admin/orders/${order.id}/refund`).set(auth(staff.token)).set('Idempotency-Key', 'refund-key-0001').send({ type: 'full', reason: 'CUSTOMER_REQUEST', restock: true });
    expect(full.body.data.order.paymentStatus).toBe('REFUNDED');
    expect(full.body.data.order.totals.refunded).toBe(order.totals.grandTotal);
    expect(full.body.data.order.status).toBe('CANCELLED');
    expect(await stockOf(p.variants[0].id)).toEqual({ stock_quantity: 2, reserved_quantity: 0 });

    const replay = await api().post(`/api/v1/admin/orders/${order.id}/refund`).set(auth(staff.token)).set('Idempotency-Key', 'refund-key-0001').send({ type: 'full', reason: 'CUSTOMER_REQUEST' });
    expect(replay.body.data.refund.id).toBe(full.body.data.refund.id);
    const again = await api().post(`/api/v1/admin/orders/${order.id}/refund`).set(auth(staff.token)).send({ type: 'full', reason: 'OTHER' });
    expect(again.body.error.code).toBe('ORDER_INVALID');
  });

  it('expires unpaid orders and releases their stock', async () => {
    const { p, order } = await cardOrder();
    await query(`update public.orders set payment_expires_at = now() - interval '1 minute' where id = $1`, [order.id]);
    const { ordersService } = await import('../../src/modules/orders/orders.service.js');
    expect(await ordersService.expireUnpaidOrders()).toBe(1);
    expect(await stockOf(p.variants[0].id)).toEqual({ stock_quantity: 2, reserved_quantity: 0 });
    const o = await queryOne<{ status: string; payment_status: string }>(`select status, payment_status from public.orders where id = $1`, [order.id]);
    expect(o).toEqual({ status: 'CANCELLED', payment_status: 'CANCELLED' });
  });
});
