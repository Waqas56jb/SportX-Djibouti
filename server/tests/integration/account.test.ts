import { beforeEach, describe, expect, it } from 'vitest';
import { address, api, auth, createProduct, createStaff, PASSWORD, putInCart, registerCustomer, resetData } from '../helpers/fixtures.js';
import { query, queryOne } from '../../src/config/database.js';

const cookieHeader = (cookies: string[] | undefined) => (cookies ?? []).map((c) => c.split(';')[0]).join('; ');
const newAddress = (over: Record<string, unknown> = {}) => ({ label: 'Home', ...address, ...over });

async function login(email: string, password = PASSWORD) {
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  return { status: res.status, token: res.body.data?.accessToken as string, cookies: res.headers['set-cookie'] as unknown as string[] };
}

async function createCoupon(over: Partial<{ code: string; type: string; value: number; minimum: number }> = {}) {
  await query(`insert into public.coupons (code, type, value, minimum_order_amount) values ($1, $2, $3, $4)`, [over.code ?? 'SAVE10', over.type ?? 'PERCENTAGE', over.value ?? 10, over.minimum ?? 0]);
}

describe('users: profile, password, deletion', () => {
  beforeEach(resetData);

  it('returns and updates the own profile; email change needs the password and must be unique', async () => {
    const a = await registerCustomer();
    const b = await registerCustomer();
    const me = await api().get('/api/v1/users/me').set(auth(a.token));
    expect(me.status).toBe(200);
    expect(me.body.data.user).toMatchObject({ id: a.user.id, email: a.email });
    expect(me.body.data.user).not.toHaveProperty('password_hash');

    const upd = await api().patch('/api/v1/users/me').set(auth(a.token)).send({ firstName: 'Hodan', phone: '+253 77 11 22 33', marketingOptIn: true, id: b.user.id });
    expect(upd.status).toBe(200);
    expect(upd.body.data.user).toMatchObject({ id: a.user.id, firstName: 'Hodan', phone: '+253 77 11 22 33', marketingOptIn: true });

    expect((await api().patch('/api/v1/users/me').set(auth(a.token)).send({ email: 'new@example.com' })).status).toBe(400);
    expect((await api().patch('/api/v1/users/me').set(auth(a.token)).send({ email: 'new@example.com', currentPassword: 'wrong-pass1' })).status).toBe(400);
    const taken = await api().patch('/api/v1/users/me').set(auth(a.token)).send({ email: b.email.toUpperCase(), currentPassword: PASSWORD });
    expect(taken.status).toBe(409);
    const changed = await api().patch('/api/v1/users/me').set(auth(a.token)).send({ email: 'new@example.com', currentPassword: PASSWORD });
    expect(changed.status).toBe(200);
    expect(changed.body.data.user.email).toBe('new@example.com');
    expect((await login('new@example.com')).status).toBe(200);
    expect((await api().patch('/api/v1/users/me').set(auth(a.token)).send({ phone: 'not a phone' })).status).toBe(400);
  });

  it('password change verifies the current password and revokes other sessions only', async () => {
    const c = await registerCustomer();
    const current = cookieHeader(c.cookies);
    const other = await login(c.email);

    const wrong = await api().patch('/api/v1/users/me/password').set(auth(c.token)).set('Cookie', current).send({ currentPassword: 'Wrong12345', newPassword: 'NewPass2026' });
    expect(wrong.status).toBe(400);
    const weak = await api().patch('/api/v1/users/me/password').set(auth(c.token)).set('Cookie', current).send({ currentPassword: PASSWORD, newPassword: 'short' });
    expect(weak.status).toBe(400);

    const okRes = await api().patch('/api/v1/users/me/password').set(auth(c.token)).set('Cookie', current).send({ currentPassword: PASSWORD, newPassword: 'NewPass2026' });
    expect(okRes.status).toBe(200);

    // Only the caller's refresh session survives.
    const live = await query<{ n: number }>(`select count(*)::int as n from public.auth_sessions where user_id = $1 and revoked_at is null`, [c.user.id]);
    expect(live[0].n).toBe(1);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', current)).status).toBe(200);
    // The other device is signed out (re-use of its revoked token also revokes everything, by design).
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', cookieHeader(other.cookies))).status).toBe(401);
    expect((await login(c.email)).status).toBe(401);
    expect((await login(c.email, 'NewPass2026')).status).toBe(200);
  });

  it('account deletion is refused with open orders, then anonymises and signs out', async () => {
    const p = await createProduct();
    const c = await registerCustomer();
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    const order = await api().post('/api/v1/orders').set(auth(c.token)).send({ shippingMethod: 'standard', paymentMethod: 'CASH_ON_DELIVERY', address });
    expect(order.status).toBe(201);
    await api().post('/api/v1/addresses').set(auth(c.token)).send(newAddress());

    expect((await api().delete('/api/v1/users/me').set(auth(c.token)).send({ password: 'Wrong12345' })).status).toBe(400);
    const blocked = await api().delete('/api/v1/users/me').set(auth(c.token)).send({ password: PASSWORD });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('CONFLICT');

    const cancel = await api().post(`/api/v1/orders/${order.body.data.id}/cancel`).set(auth(c.token)).send({ reason: 'Changed my mind' });
    expect(cancel.status).toBe(200);

    const del = await api().delete('/api/v1/users/me').set(auth(c.token)).send({ password: PASSWORD });
    expect(del.status).toBe(200);
    const row = await queryOne<{ email: string; first_name: string; status: string; deleted_at: Date | null; phone: string | null }>(`select email, first_name, status, deleted_at, phone from public.users where id = $1`, [c.user.id]);
    expect(row).toMatchObject({ email: `deleted-${c.user.id}@deleted.invalid`, first_name: 'Deleted', status: 'INACTIVE', phone: null });
    expect(row!.deleted_at).not.toBeNull();
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.addresses where user_id = $1`, [c.user.id]))!.n).toBe(0);
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.orders where user_id = $1`, [c.user.id]))!.n).toBe(1);
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.auth_sessions where user_id = $1 and revoked_at is null`, [c.user.id]))!.n).toBe(0);
    expect((await api().get('/api/v1/users/me').set(auth(c.token))).status).toBe(401);
    expect((await login(c.email)).status).toBe(401);
  });
});

describe('addresses', () => {
  beforeEach(resetData);

  it('keeps exactly one default and promotes the most recent when the default is deleted', async () => {
    const c = await registerCustomer();
    const first = await api().post('/api/v1/addresses').set(auth(c.token)).send(newAddress({ label: 'Home' }));
    expect(first.status).toBe(201);
    expect(first.body.data.isDefault).toBe(true);
    const second = await api().post('/api/v1/addresses').set(auth(c.token)).send(newAddress({ label: 'Work', line1: 'Avenue 13, Plateau', addressLine1: undefined }));
    expect(second.status).toBe(201);
    expect(second.body.data).toMatchObject({ isDefault: false, addressLine1: 'Avenue 13, Plateau', country: 'Djibouti' });
    const third = await api().post('/api/v1/addresses').set(auth(c.token)).send(newAddress({ label: 'Gym', isDefault: true }));
    expect(third.body.data.isDefault).toBe(true);

    const defaults = async () => (await api().get('/api/v1/addresses').set(auth(c.token))).body.data.filter((a: { isDefault: boolean }) => a.isDefault);
    expect((await defaults()).map((a: { id: string }) => a.id)).toEqual([third.body.data.id]);

    const set = await api().patch(`/api/v1/addresses/${first.body.data.id}/default`).set(auth(c.token));
    expect(set.body.data.isDefault).toBe(true);
    expect((await defaults()).map((a: { id: string }) => a.id)).toEqual([first.body.data.id]);

    // Unsetting the default directly is ignored (still exactly one default).
    await api().patch(`/api/v1/addresses/${first.body.data.id}`).set(auth(c.token)).send({ isDefault: false, city: 'Arta' });
    expect((await defaults()).map((a: { id: string }) => a.id)).toEqual([first.body.data.id]);

    expect((await api().delete(`/api/v1/addresses/${first.body.data.id}`).set(auth(c.token))).status).toBe(200);
    expect((await defaults()).map((a: { id: string }) => a.id)).toEqual([third.body.data.id]); // most recent

    expect((await api().post('/api/v1/addresses').set(auth(c.token)).send(newAddress({ phone: 'abc' }))).status).toBe(400);
  });

  it("customer A cannot read or modify B's address (404)", async () => {
    const a = await registerCustomer();
    const b = await registerCustomer();
    const addr = await api().post('/api/v1/addresses').set(auth(b.token)).send(newAddress());
    const id = addr.body.data.id;
    expect((await api().get(`/api/v1/addresses/${id}`).set(auth(a.token))).status).toBe(404);
    expect((await api().patch(`/api/v1/addresses/${id}`).set(auth(a.token)).send({ city: 'Obock' })).status).toBe(404);
    expect((await api().patch(`/api/v1/addresses/${id}/default`).set(auth(a.token))).status).toBe(404);
    expect((await api().delete(`/api/v1/addresses/${id}`).set(auth(a.token))).status).toBe(404);
    expect((await api().get('/api/v1/addresses').set(auth(a.token))).body.data).toEqual([]);
    expect((await api().get(`/api/v1/addresses/${id}`).set(auth(b.token))).body.data.city).toBe('Djibouti City');
    expect((await api().get('/api/v1/addresses')).status).toBe(401);
  });
});

describe('cart', () => {
  beforeEach(resetData);

  it('adds, merges lines, rejects quantities beyond stock and prices on the server', async () => {
    const p = await createProduct({ price: 12000, stock: 3 });
    const c = await registerCustomer();
    const v = p.variants[0].id;

    const add = await api().post('/api/v1/cart/items').set(auth(c.token)).send({ variantId: v, quantity: 2, unitPrice: 1 });
    expect(add.status).toBe(200);
    expect(add.body.data.items).toHaveLength(1);
    expect(add.body.data.items[0]).toMatchObject({ variantId: v, quantity: 2, unitPrice: 12000, lineTotal: 24000, maxStock: 3 });
    expect(add.body.data.totals).toMatchObject({ subtotal: 24000, grandTotal: 24000, freeShippingRemaining: 1000 });

    const again = await api().post('/api/v1/cart/items').set(auth(c.token)).send({ variantId: v, quantity: 1 });
    expect(again.body.data.items).toHaveLength(1);
    expect(again.body.data.items[0].quantity).toBe(3);

    const beyond = await api().post('/api/v1/cart/items').set(auth(c.token)).send({ variantId: v, quantity: 1 });
    expect(beyond.status).toBe(409);
    expect(beyond.body.error.code).toBe('OUT_OF_STOCK');

    const itemId = again.body.data.items[0].id;
    expect((await api().patch(`/api/v1/cart/items/${itemId}`).set(auth(c.token)).send({ quantity: 5 })).body.error.code).toBe('OUT_OF_STOCK');
    const lower = await api().patch(`/api/v1/cart/items/${itemId}`).set(auth(c.token)).send({ quantity: 1 });
    expect(lower.body.data.totals.subtotal).toBe(12000);

    // Tampering with the stored snapshot never changes what is charged.
    await query(`update public.cart_items set unit_price_snapshot = 1`);
    const tampered = await api().get('/api/v1/cart').set(auth(c.token));
    expect(tampered.body.data.items[0].unitPrice).toBe(12000);
    expect(tampered.body.data.totals.subtotal).toBe(12000);
    expect(tampered.body.data.issues.map((i: { type: string }) => i.type)).toContain('PRICE_CHANGED');

    const zero = await api().patch(`/api/v1/cart/items/${itemId}`).set(auth(c.token)).send({ quantity: 0 });
    expect(zero.body.data.items).toHaveLength(0);

    const draft = await createProduct({ status: 'DRAFT' });
    expect((await api().post('/api/v1/cart/items').set(auth(c.token)).send({ variantId: draft.variants[0].id, quantity: 1 })).status).toBe(404);
  });

  it('clamps stored quantities when stock drops and reports the issue', async () => {
    const p = await createProduct({ stock: 5 });
    const c = await registerCustomer();
    await api().post('/api/v1/cart/items').set(auth(c.token)).send({ variantId: p.variants[0].id, quantity: 4 });
    await query(`update public.inventory set stock_quantity = 2 where variant_id = $1`, [p.variants[0].id]);
    const res = await api().get('/api/v1/cart').set(auth(c.token));
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.issues[0]).toMatchObject({ type: 'INSUFFICIENT_STOCK', available: 2 });
    expect((await queryOne<{ quantity: number }>(`select quantity from public.cart_items`))!.quantity).toBe(2);
  });

  it('merges a guest bag, clamping to stock and skipping unavailable items', async () => {
    const p = await createProduct({ stock: 2 });
    const q = await createProduct({ stock: 10 });
    const draft = await createProduct({ status: 'DRAFT' });
    const c = await registerCustomer();
    await api().post('/api/v1/cart/items').set(auth(c.token)).send({ variantId: q.variants[0].id, quantity: 1 });

    const res = await api()
      .post('/api/v1/cart/merge')
      .set(auth(c.token))
      .send({ items: [{ variantId: p.variants[0].id, quantity: 5 }, { variantId: q.variants[0].id, quantity: 3 }, { variantId: draft.variants[0].id, quantity: 1 }] });
    expect(res.status).toBe(200);
    const qty = Object.fromEntries(res.body.data.items.map((i: { variantId: string; quantity: number }) => [i.variantId, i.quantity]));
    expect(qty).toEqual({ [p.variants[0].id]: 2, [q.variants[0].id]: 3 });
    expect(res.body.data.mergeIssues.map((i: { type: string }) => i.type).sort()).toEqual(['QUANTITY_REDUCED', 'UNAVAILABLE']);

    // Re-sending the same bag does not double quantities.
    const again = await api().post('/api/v1/cart/merge').set(auth(c.token)).send({ items: [{ variantId: q.variants[0].id, quantity: 3 }] });
    expect(again.body.data.items.find((i: { variantId: string }) => i.variantId === q.variants[0].id).quantity).toBe(3);
  });

  it('applies only valid coupons to the cart and uses them in totals', async () => {
    const p = await createProduct({ price: 10000, stock: 10 });
    const c = await registerCustomer();
    await createCoupon({ code: 'SAVE10', value: 10 });
    await createCoupon({ code: 'BIG', type: 'FIXED', value: 1000, minimum: 50000 });

    expect((await api().post('/api/v1/cart/coupon').set(auth(c.token)).send({ code: 'save10' })).body.error.code).toBe('INVALID_COUPON'); // empty cart
    await api().post('/api/v1/cart/items').set(auth(c.token)).send({ variantId: p.variants[0].id, quantity: 2 });

    const bad = await api().post('/api/v1/cart/coupon').set(auth(c.token)).send({ code: 'NOPE' });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('INVALID_COUPON');
    const min = await api().post('/api/v1/cart/coupon').set(auth(c.token)).send({ code: 'BIG' });
    expect(min.body.error.code).toBe('INVALID_COUPON');
    expect((await queryOne<{ coupon_code: string | null }>(`select coupon_code from public.carts`))!.coupon_code).toBeNull();

    const good = await api().post('/api/v1/cart/coupon').set(auth(c.token)).send({ code: 'save10' });
    expect(good.status).toBe(200);
    expect(good.body.data.coupon).toMatchObject({ code: 'SAVE10', valid: true, discount: 2000 });
    expect(good.body.data.totals).toMatchObject({ subtotal: 20000, couponDiscount: 2000, grandTotal: 18000 });

    const preview = await api().post('/api/v1/coupons/validate').set(auth(c.token)).send({ code: 'SAVE10', subtotal: 999999 });
    expect(preview.body.data).toMatchObject({ valid: true, code: 'SAVE10', discount: 2000, type: 'PERCENTAGE', value: 10 });
    const invalid = await api().post('/api/v1/coupons/validate').set(auth(c.token)).send({ code: 'NOPE' });
    expect(invalid.body.data).toMatchObject({ valid: false, discount: 0 });

    const removed = await api().delete('/api/v1/cart/coupon').set(auth(c.token));
    expect(removed.body.data.coupon).toBeNull();
    const cleared = await api().delete('/api/v1/cart').set(auth(c.token));
    expect(cleared.body.data.items).toEqual([]);
  });

  it("cannot touch another customer's cart line", async () => {
    const p = await createProduct();
    const a = await registerCustomer();
    const b = await registerCustomer();
    const res = await api().post('/api/v1/cart/items').set(auth(b.token)).send({ variantId: p.variants[0].id, quantity: 1 });
    const itemId = res.body.data.items[0].id;
    expect((await api().patch(`/api/v1/cart/items/${itemId}`).set(auth(a.token)).send({ quantity: 2 })).status).toBe(404);
    expect((await api().delete(`/api/v1/cart/items/${itemId}`).set(auth(a.token))).status).toBe(404);
    expect((await api().get('/api/v1/cart').set(auth(b.token))).body.data.items[0].quantity).toBe(1);
  });
});

describe('wishlist', () => {
  beforeEach(resetData);

  it('is idempotent, hides unpublished products and merges guest lists', async () => {
    const p = await createProduct();
    const q = await createProduct();
    const draft = await createProduct({ status: 'DRAFT' });
    const c = await registerCustomer();

    await api().post(`/api/v1/wishlist/${p.productId}`).set(auth(c.token));
    const twice = await api().post(`/api/v1/wishlist/${p.productId}`).set(auth(c.token));
    expect(twice.status).toBe(200);
    expect(twice.body.data.ids).toEqual([p.productId]);
    expect(twice.body.data.items[0].product).toMatchObject({ id: p.productId, price: 20000, inStock: true });
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.wishlist_items`))!.n).toBe(1);

    expect((await api().post(`/api/v1/wishlist/${draft.productId}`).set(auth(c.token))).status).toBe(404);
    expect((await api().get(`/api/v1/wishlist/check/${p.productId}`).set(auth(c.token))).body.data).toEqual({ inWishlist: true });
    expect((await api().get(`/api/v1/wishlist/check/${q.productId}`).set(auth(c.token))).body.data).toEqual({ inWishlist: false });

    const merged = await api().post('/api/v1/wishlist/merge').set(auth(c.token)).send({ productIds: [p.productId, q.productId, draft.productId] });
    expect(merged.body.data.ids.sort()).toEqual([p.productId, q.productId].sort());

    await query(`update public.products set status = 'ARCHIVED' where id = $1`, [q.productId]);
    expect((await api().get('/api/v1/wishlist').set(auth(c.token))).body.data.ids).toEqual([p.productId]);

    const removed = await api().delete(`/api/v1/wishlist/${p.productId}`).set(auth(c.token));
    expect(removed.body.data.ids).toEqual([]);
  });
});

describe('notifications and dashboard', () => {
  beforeEach(resetData);

  it("lists own notifications with unread counts; B cannot touch A's notification", async () => {
    const a = await registerCustomer();
    const b = await registerCustomer();
    for (const t of ['First', 'Second']) {
      await query(`insert into public.notifications (audience, user_id, type, title, message) values ('CUSTOMER', $1, 'ORDER_CREATED', $2, 'x')`, [a.user.id, t]);
    }
    const list = await api().get('/api/v1/notifications').set(auth(a.token));
    expect(list.body.data).toHaveLength(2);
    expect(list.body.unreadCount).toBe(2);
    const id = list.body.data[0].id;

    expect((await api().patch(`/api/v1/notifications/${id}/read`).set(auth(b.token))).status).toBe(404);
    expect((await api().delete(`/api/v1/notifications/${id}`).set(auth(b.token))).status).toBe(404);
    expect((await api().get('/api/v1/notifications').set(auth(b.token))).body.data).toEqual([]);

    const read = await api().patch(`/api/v1/notifications/${id}/read`).set(auth(a.token));
    expect(read.body.data).toMatchObject({ notification: { id, read: true }, unreadCount: 1 });
    expect((await api().get('/api/v1/notifications?unread=true').set(auth(a.token))).body.data).toHaveLength(1);
    await api().patch(`/api/v1/notifications/${id}/unread`).set(auth(a.token));
    expect((await api().patch('/api/v1/notifications/read-all').set(auth(a.token))).body.data.updated).toBe(2);
    expect((await api().delete(`/api/v1/notifications/${id}`).set(auth(a.token))).status).toBe(200);
  });

  it('staff share the admin notification centre', async () => {
    const staff = await createStaff('ORDER_MANAGER');
    await registerCustomer(); // NEW_CUSTOMER staff notification
    const list = await api().get('/api/v1/admin/notifications').set(auth(staff.token));
    expect(list.status).toBe(200);
    expect(list.body.data.map((n: { type: string }) => n.type)).toContain('NEW_CUSTOMER');
    const ids = list.body.data.map((n: { id: string }) => n.id);
    const read = await api().patch('/api/v1/admin/notifications').set(auth(staff.token)).send({ ids, read: true });
    expect(read.body.data.unreadCount).toBe(0);
    const del = await api().post('/api/v1/admin/notifications/delete').set(auth(staff.token)).send({ ids });
    expect(del.body.data.deleted).toBe(ids.length);
    const customer = await registerCustomer();
    expect((await api().get('/api/v1/admin/notifications').set(auth(customer.token))).status).toBe(403);
  });

  it('aggregates the account dashboard', async () => {
    const p = await createProduct();
    const c = await registerCustomer();
    await api().post('/api/v1/addresses').set(auth(c.token)).send(newAddress());
    await api().post(`/api/v1/wishlist/${p.productId}`).set(auth(c.token));
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    await api().post('/api/v1/orders').set(auth(c.token)).send({ shippingMethod: 'standard', paymentMethod: 'CASH_ON_DELIVERY', address });
    await api().post('/api/v1/support/tickets').set(auth(c.token)).send({ subject: 'Sizing question', category: 'product', message: 'Does it run small?' });

    const res = await api().get('/api/v1/account/dashboard').set(auth(c.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      user: { id: c.user.id },
      orderCounts: { total: 1, active: 1, pending: 1, delivered: 0, cancelled: 0 },
      wishlistCount: 1,
      addressesCount: 1,
      openTickets: 1,
      reviewsCount: 0,
    });
    expect(res.body.data.recentOrders).toHaveLength(1);
    expect(res.body.data.defaultAddress.isDefault).toBe(true);
    expect(res.body.data.unreadNotifications).toBeGreaterThanOrEqual(1);
  });
});

describe('newsletter and contact', () => {
  beforeEach(resetData);

  it('subscribes once and stores contact messages', async () => {
    expect((await api().post('/api/v1/newsletter').send({ email: 'Fan@Example.com' })).body.data).toEqual({ alreadySubscribed: false });
    expect((await api().post('/api/v1/newsletter').send({ email: 'fan@example.com' })).body.data).toEqual({ alreadySubscribed: true });
    expect((await api().post('/api/v1/newsletter').send({ email: 'nope' })).status).toBe(400);

    const contact = await api().post('/api/v1/contact').send({ name: 'Hodan Ali', email: 'h@example.com', message: 'Do you stock size 46?' });
    expect(contact.status).toBe(201);
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.contact_messages`))!.n).toBe(1);
    expect((await api().post('/api/v1/contact').send({ name: 'H', email: 'h@example.com', message: '' })).status).toBe(400);
  });
});
