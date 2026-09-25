/**
 * End-to-end business flows (spec §93), exercised only through the HTTP API.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { address, api, auth, createStaff, PASSWORD, resetData } from '../helpers/fixtures.js';

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function adminCatalog(token: string, opts: { stock: number; price?: number }) {
  const cat = await api().post('/api/v1/admin/categories').set(auth(token)).send({ name: 'Football Boots', slug: `boots-${Date.now()}`, description: 'Boots' });
  expect(cat.status).toBe(201);
  const brand = await api().post('/api/v1/admin/brands').set(auth(token)).send({ name: `SPORTX ELITE ${Date.now()}`, description: 'Elite range' });
  expect(brand.status).toBe(201);
  const sku = `SX-FLOW-${Date.now().toString(36).toUpperCase()}`;
  const product = await api()
    .post('/api/v1/admin/products')
    .set(auth(token))
    .send({
      name: 'SPORTX Pro Elite Boot',
      sku,
      brandId: brand.body.data.id,
      categoryId: cat.body.data.id,
      department: 'footwear',
      sport: 'football',
      gender: 'MEN',
      price: opts.price ?? 32500,
      status: 'DRAFT',
      shortDescription: 'Firm-ground match boot.',
      variants: ['39', '40', '41'].map((size) => ({ color: 'Black', colorHex: '#111111', size, sku: `${sku}-BLK-${size}`, stock: opts.stock })),
    });
  expect(product.status).toBe(201);
  return { product: product.body.data, sku };
}

describe('Flow 1 — register → login → browse → cart → checkout → order', () => {
  beforeEach(resetData);

  it('completes a purchase entirely through the API', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const { product } = await adminCatalog(admin.token, { stock: 5 });
    await api().post(`/api/v1/admin/products/${product.id}/images`).set(auth(admin.token)).field('role', 'MAIN').attach('file', PNG_1x1, 'boot.png').expect(201);
    await api().patch(`/api/v1/admin/products/${product.id}/status`).set(auth(admin.token)).send({ status: 'PUBLISHED' }).expect(200);

    const email = `flow1_${Date.now()}@example.com`;
    await api().post('/api/v1/auth/register').send({ firstName: 'Hodan', lastName: 'Ali', email, password: PASSWORD }).expect(201);
    const login = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
    const token = login.body.data.accessToken;

    const list = await api().get('/api/v1/products').query({ q: 'Elite', size: '40' }).expect(200);
    const found = list.body.data.find((p: { id: string }) => p.id === product.id);
    expect(found).toBeTruthy();
    const pdp = await api().get(`/api/v1/products/${found.slug}`).expect(200);
    const variant = pdp.body.data.variants.find((v: { size: string }) => v.size === '40');
    expect(variant.available).toBe(5);

    const cart = await api().post('/api/v1/cart/items').set(auth(token)).send({ variantId: variant.id, quantity: 2 });
    expect(cart.status).toBe(200);
    expect(cart.body.data.totals.subtotal).toBe(65000);

    const check = await api().post('/api/v1/checkout/validate').set(auth(token)).send({ shippingMethod: 'standard', address, paymentMethod: 'CASH_ON_DELIVERY' });
    expect(check.body.data.valid).toBe(true);
    expect(check.body.data.totals.shipping).toBe(0); // above the free-shipping threshold

    const order = await api().post('/api/v1/orders').set(auth(token)).set('Idempotency-Key', 'flow1-order-key').send({ shippingMethod: 'standard', paymentMethod: 'CASH_ON_DELIVERY', address });
    expect(order.status).toBe(201);
    expect(order.body.data.totals.grandTotal).toBe(65000);
    expect((await api().get('/api/v1/cart').set(auth(token))).body.data.items).toHaveLength(0);
    const after = await api().get(`/api/v1/products/${found.slug}`);
    expect(after.body.data.variants.find((v: { id: string }) => v.id === variant.id).available).toBe(3);
  });
});

describe('Flow 2 — admin creates, stocks and publishes a product', () => {
  beforeEach(resetData);

  it('is invisible while draft and sellable once published', async () => {
    const admin = await createStaff('ADMIN');
    const { product } = await adminCatalog(admin.token, { stock: 0 });
    expect((await api().get(`/api/v1/products/${product.slug}`)).status).toBe(404);

    const noImage = await api().patch(`/api/v1/admin/products/${product.id}/status`).set(auth(admin.token)).send({ status: 'PUBLISHED' });
    expect(noImage.status).toBe(400);

    await api().post(`/api/v1/admin/products/${product.id}/images`).set(auth(admin.token)).field('role', 'MAIN').attach('file', PNG_1x1, 'boot.png').expect(201);
    const inv = await api().get('/api/v1/admin/inventory').query({ search: product.sku }).set(auth(admin.token));
    const row = inv.body.data[0];
    await api().post(`/api/v1/admin/inventory/${row.variantId}/adjust`).set(auth(admin.token)).send({ mode: 'add', quantity: 12, reason: 'RESTOCK' }).expect(200);
    await api().patch(`/api/v1/admin/products/${product.id}/status`).set(auth(admin.token)).send({ status: 'PUBLISHED' }).expect(200);

    const pdp = await api().get(`/api/v1/products/${product.slug}`).expect(200);
    expect(pdp.body.data.variants.find((v: { id: string }) => v.id === row.variantId).available).toBe(12);

    // RBAC: a product manager manages the catalogue but not stock levels.
    const pm = await createStaff('PRODUCT_MANAGER');
    expect((await api().post(`/api/v1/admin/inventory/${row.variantId}/adjust`).set(auth(pm.token)).send({ mode: 'add', quantity: 1, reason: 'RESTOCK' })).status).toBe(403);
  });
});

describe('Flow 3 — purchase → payment confirmation → processing → shipping → delivery', () => {
  beforeEach(resetData);

  it('moves a card order through its whole lifecycle', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const { product } = await adminCatalog(admin.token, { stock: 3, price: 30000 });
    await api().post(`/api/v1/admin/products/${product.id}/images`).set(auth(admin.token)).field('role', 'MAIN').attach('file', PNG_1x1, 'b.png');
    await api().patch(`/api/v1/admin/products/${product.id}/status`).set(auth(admin.token)).send({ status: 'PUBLISHED' });
    const variant = (await api().get(`/api/v1/admin/products/${product.id}`).set(auth(admin.token))).body.data.variants[0];

    const email = `flow3_${Date.now()}@example.com`;
    const reg = await api().post('/api/v1/auth/register').send({ firstName: 'Omar', lastName: 'Farah', email, password: PASSWORD });
    const token = reg.body.data.accessToken;
    await api().post('/api/v1/cart/items').set(auth(token)).send({ variantId: variant.id, quantity: 1 }).expect(200);
    const order = (await api().post('/api/v1/orders').set(auth(token)).send({ shippingMethod: 'express', paymentMethod: 'CARD', address })).body.data;
    expect(order.status).toBe('PAYMENT_PENDING');

    const pay = (await api().post('/api/v1/payments/create').set(auth(token)).send({ orderId: order.id })).body.data;
    await api().post(`/api/v1/payments/${pay.payment.id}/mock-complete`).set(auth(token)).send({ outcome: 'succeeded' }).expect(200);

    for (const status of ['PROCESSING', 'PACKED']) await api().patch(`/api/v1/admin/orders/${order.id}/status`).set(auth(admin.token)).send({ status }).expect(200);
    await api().patch(`/api/v1/admin/orders/${order.id}/shipping`).set(auth(admin.token)).send({ carrier: 'SPORTX Courier', trackingNumber: 'SPXD123456' }).expect(200);
    for (const status of ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']) await api().patch(`/api/v1/admin/orders/${order.id}/status`).set(auth(admin.token)).send({ status }).expect(200);

    const final = (await api().get(`/api/v1/orders/${order.id}`).set(auth(token))).body.data;
    expect(final.status).toBe('DELIVERED');
    expect(final.paymentStatus).toBe('PAID');
    expect(final.shipping).toMatchObject({ status: 'DELIVERED', trackingNumber: 'SPXD123456' });
    expect(final.timeline.map((t: { status: string }) => t.status)).toEqual(['PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']);
    const notes = (await api().get('/api/v1/notifications').set(auth(token))).body.data.map((n: { type: string }) => n.type);
    expect(notes).toEqual(expect.arrayContaining(['ORDER_CREATED', 'PAYMENT_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_DELIVERED']));
  });
});

describe('Flow 4 — customer review → admin moderation → review visible', () => {
  beforeEach(resetData);

  it('publishes a verified review only after approval', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const { product } = await adminCatalog(admin.token, { stock: 2 });
    await api().post(`/api/v1/admin/products/${product.id}/images`).set(auth(admin.token)).field('role', 'MAIN').attach('file', PNG_1x1, 'b.png');
    await api().patch(`/api/v1/admin/products/${product.id}/status`).set(auth(admin.token)).send({ status: 'PUBLISHED' });
    const variant = (await api().get(`/api/v1/admin/products/${product.id}`).set(auth(admin.token))).body.data.variants[0];

    const reg = await api().post('/api/v1/auth/register').send({ firstName: 'Amina', lastName: 'Yusuf', email: `flow4_${Date.now()}@example.com`, password: PASSWORD });
    const token = reg.body.data.accessToken;
    const review = { rating: 5, title: 'Best boot I have owned', comment: 'Locked in from the first session and very light.' };
    expect((await api().post(`/api/v1/products/${product.id}/reviews`).set(auth(token)).send(review)).status).toBe(403);

    await api().post('/api/v1/cart/items').set(auth(token)).send({ variantId: variant.id, quantity: 1 });
    const order = (await api().post('/api/v1/orders').set(auth(token)).send({ shippingMethod: 'pickup', paymentMethod: 'CASH_ON_DELIVERY' })).body.data;
    for (const status of ['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']) await api().patch(`/api/v1/admin/orders/${order.id}/status`).set(auth(admin.token)).send({ status }).expect(200);

    const created = await api().post(`/api/v1/products/${product.id}/reviews`).set(auth(token)).send(review);
    expect(created.status).toBe(201);
    expect((await api().get(`/api/v1/products/${product.id}/reviews`)).body.data.reviews).toHaveLength(0);

    const pending = await api().get('/api/v1/admin/reviews').query({ status: 'PENDING' }).set(auth(admin.token));
    const id = pending.body.data[0].id;
    await api().patch(`/api/v1/admin/reviews/${id}/status`).set(auth(admin.token)).send({ status: 'APPROVED' }).expect(200);

    const visible = (await api().get(`/api/v1/products/${product.id}/reviews`)).body.data;
    expect(visible.reviews).toHaveLength(1);
    expect(visible.reviews[0].verifiedPurchase).toBe(true);
    expect(visible.summary.average).toBe(5);
  });
});

describe('Flow 5 — admin inventory adjustment → product availability', () => {
  beforeEach(resetData);

  it('reflects stock changes on the storefront immediately', async () => {
    const admin = await createStaff('INVENTORY_MANAGER');
    const catalogAdmin = await createStaff('PRODUCT_MANAGER');
    const { product } = await adminCatalog(catalogAdmin.token, { stock: 1 });
    await api().post(`/api/v1/admin/products/${product.id}/images`).set(auth(catalogAdmin.token)).field('role', 'MAIN').attach('file', PNG_1x1, 'b.png');
    await api().patch(`/api/v1/admin/products/${product.id}/status`).set(auth(catalogAdmin.token)).send({ status: 'PUBLISHED' });

    const rows = (await api().get('/api/v1/admin/inventory').query({ search: product.sku }).set(auth(admin.token))).body.data;
    for (const r of rows) await api().post(`/api/v1/admin/inventory/${r.variantId}/adjust`).set(auth(admin.token)).send({ mode: 'set', quantity: 0, reason: 'DAMAGED', note: 'Water damage' }).expect(200);
    expect((await api().get(`/api/v1/products/${product.slug}`)).body.data.stockStatus).toBe('OUT_OF_STOCK');

    await api().post(`/api/v1/admin/inventory/${rows[0].variantId}/adjust`).set(auth(admin.token)).send({ mode: 'add', quantity: 4, reason: 'RESTOCK' }).expect(200);
    const pdp = (await api().get(`/api/v1/products/${product.slug}`)).body.data;
    expect(pdp.stockStatus).not.toBe('OUT_OF_STOCK');
    expect(pdp.variants.find((v: { id: string }) => v.id === rows[0].variantId).available).toBe(4);

    const moves = (await api().get('/api/v1/admin/inventory/movements').query({ variant: rows[0].variantId }).set(auth(admin.token))).body.data;
    expect(moves.map((m: { reason: string }) => m.reason)).toEqual(expect.arrayContaining(['DAMAGED', 'RESTOCK']));
    // Inventory managers cannot touch orders or settings.
    expect((await api().get('/api/v1/admin/settings/payments').set(auth(admin.token))).status).toBe(403);
  });
});
