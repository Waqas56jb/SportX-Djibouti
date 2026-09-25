import { beforeEach, describe, expect, it } from 'vitest';
import { address, api, auth, createProduct, createStaff, putInCart, registerCustomer, resetData, stockOf } from '../helpers/fixtures.js';
import { query, queryOne } from '../../src/config/database.js';

async function placeOrder(token: string, userId: string, variantId: string, quantity = 1) {
  await putInCart(userId, [{ variantId, quantity }]);
  const res = await api().post('/api/v1/orders').set(auth(token)).send({ shippingMethod: 'standard', paymentMethod: 'CASH_ON_DELIVERY', address });
  if (res.status !== 201) throw new Error(`order failed ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data as { id: string; totals: { grandTotal: number } };
}

async function deliver(staffToken: string, orderId: string) {
  for (const status of ['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']) {
    const r = await api().patch(`/api/v1/admin/orders/${orderId}/status`).set(auth(staffToken)).send({ status });
    if (r.status !== 200) throw new Error(`transition ${status} failed ${JSON.stringify(r.body)}`);
  }
}

describe('admin dashboard', () => {
  beforeEach(resetData);

  it('aggregates real orders: paid revenue, queues, units, top products and a zero-filled chart', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const p = await createProduct({ price: 10000, stock: 20 });
    const a = await registerCustomer();
    const b = await registerCustomer();

    const delivered = await placeOrder(a.token, a.user.id, p.variants[0].id, 2); // 20 000 + 1 000 shipping
    await deliver(admin.token, delivered.id);
    await placeOrder(b.token, b.user.id, p.variants[1].id, 1); // stays PENDING (COD, unpaid)
    const old = await placeOrder(a.token, a.user.id, p.variants[0].id, 1); // 10 000 + 1 000
    await deliver(admin.token, old.id);
    await query(`update public.orders set placed_at = now() - interval '8 days' where id = $1`, [old.id]);

    const res = await api().get('/api/v1/admin/dashboard?range=7d').set(auth(admin.token));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.sales.totalSales).toBe(21000 + 11000);
    expect(d.sales.periodRevenue).toBe(21000);
    expect(d.sales.previousPeriodRevenue).toBe(11000);
    expect(d.sales.todaySales).toBe(21000);
    expect(d.sales.change).toBeCloseTo(90.9, 1);
    expect(d.orders).toMatchObject({ total: 3, periodOrders: 2, previous: 1, pending: 1, completed: 1, cancelled: 0, refundRequests: 0 });
    expect(d.customers).toMatchObject({ total: 2, newInPeriod: 2 });
    expect(d.productsSold.value).toBe(3);
    expect(d.products).toMatchObject({ total: 1, published: 1 });
    expect(d.recentOrders).toHaveLength(3);
    expect(d.topProducts[0]).toMatchObject({ productId: p.productId, unitsSold: 3, revenue: 30000 });
    expect(d.salesChart).toHaveLength(7);
    expect(d.salesChart.reduce((s: number, x: { revenue: number }) => s + x.revenue, 0)).toBe(21000);
    expect(d.salesChart.filter((x: { revenue: number }) => x.revenue === 0)).toHaveLength(6);
    expect(d.salesByCategory).toHaveLength(1);
    expect(d.salesByCategory[0]).toMatchObject({ category: 'Footwear', share: 100 });
    expect(d.kpis.revenue.trend).toHaveLength(7);

    const today = await api().get('/api/v1/admin/dashboard?range=today').set(auth(admin.token));
    expect(today.body.data.range.bucket).toBe('hour');
    expect(today.body.data.sales.periodRevenue).toBe(21000);

    // A refund reduces revenue.
    await query(`update public.orders set refunded_total = 5000, payment_status = 'PARTIALLY_REFUNDED' where id = $1`, [delivered.id]);
    const after = await api().get('/api/v1/admin/dashboard?range=30d').set(auth(admin.token));
    expect(after.body.data.sales.periodRevenue).toBe(16000 + 11000);
  });

  it('requires dashboard:view and validates custom ranges', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    expect((await api().get('/api/v1/admin/dashboard?range=custom').set(auth(admin.token))).status).toBe(400);
    expect((await api().get('/api/v1/admin/dashboard?range=custom&from=2026-02-10&to=2026-02-01').set(auth(admin.token))).status).toBe(400);
    const ok = await api().get('/api/v1/admin/dashboard?range=custom&from=2026-01-01&to=2026-01-31').set(auth(admin.token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.salesChart).toHaveLength(31);
    const c = await registerCustomer();
    expect((await api().get('/api/v1/admin/dashboard').set(auth(c.token))).status).toBe(403);
  });
});

describe('reports', () => {
  beforeEach(resetData);

  it('buckets sales by day/week/month with zero-filled periods and previous-period totals', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const p = await createProduct({ price: 10000, stock: 20 });
    const c = await registerCustomer();
    const o = await placeOrder(c.token, c.user.id, p.variants[0].id, 1);
    await deliver(admin.token, o.id);

    const week = await api().get('/api/v1/admin/reports/sales?range=7d').set(auth(admin.token));
    expect(week.status).toBe(200);
    expect(week.body.data.series).toHaveLength(7);
    expect(week.body.data.totals).toMatchObject({ revenue: 11000, orders: 1, aov: 11000, shipping: 1000, grossSales: 10000, refunds: 0, netSales: 11000 });
    expect(week.body.data.previous.revenue).toBe(0);
    expect(week.body.data.series.filter((s: { orders: number }) => s.orders === 0)).toHaveLength(6);

    const year = await api().get('/api/v1/admin/reports/sales?range=12m').set(auth(admin.token));
    expect(year.body.data.series).toHaveLength(12);
    expect(year.body.data.range.bucket).toBe('month');

    const custom = await api().get('/api/v1/admin/reports/sales?range=custom&from=2026-01-01&to=2026-01-10').set(auth(admin.token));
    expect(custom.body.data.series).toHaveLength(10);
    expect(custom.body.data.series.every((s: { revenue: number }) => s.revenue === 0)).toBe(true);

    const weekly = await api().get('/api/v1/admin/reports/sales?range=30d&groupBy=week').set(auth(admin.token));
    expect(weekly.body.data.range.bucket).toBe('week');
    expect(weekly.body.data.series.length).toBeGreaterThanOrEqual(5);
    expect(weekly.body.data.series.reduce((s: number, x: { revenue: number }) => s + x.revenue, 0)).toBe(11000);
  });

  it('product, customer and inventory reports use real data', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const p = await createProduct({ price: 10000, stock: 5 });
    const idle = await createProduct({ price: 5000, stock: 3 });
    await query(`update public.products set view_count = 40, cost_price = 4000 where id = $1`, [p.productId]);
    const c = await registerCustomer();
    const o1 = await placeOrder(c.token, c.user.id, p.variants[0].id, 2);
    await deliver(admin.token, o1.id);
    await placeOrder(c.token, c.user.id, p.variants[0].id, 1);

    const prod = await api().get('/api/v1/admin/reports/products?range=30d').set(auth(admin.token));
    expect(prod.status).toBe(200);
    const row = prod.body.data.items.find((i: { productId: string }) => i.productId === p.productId);
    expect(row).toMatchObject({ unitsSold: 3, revenue: 30000, views: 40, conversion: 7.5 });
    expect(prod.body.data.best[0].productId).toBe(p.productId);
    expect(prod.body.data.worst[0].productId).toBe(idle.productId);

    const cust = await api().get('/api/v1/admin/reports/customers?range=30d').set(auth(admin.token));
    expect(cust.body.data.totals).toMatchObject({ totalCustomers: 1, newCustomers: 1, buyers: 1, returningCustomers: 1, ordersPerCustomer: 2 });
    expect(cust.body.data.topCustomers[0]).toMatchObject({ id: c.user.id, orders: 1 });
    expect(cust.body.data.growth).toHaveLength(30);

    const inv = await api().get('/api/v1/admin/reports/inventory').set(auth(admin.token));
    expect(inv.status).toBe(200);
    // p: 5 - 2 committed = 3 + 5 (other size) ; idle: 3 + 3
    expect(inv.body.data.totals).toMatchObject({ products: 2, variants: 4, units: 14, stockValue: 8 * 4000 });
    expect(inv.body.data.aging).toHaveLength(4);
    expect(inv.body.data.movement.reduce((s: number, m: { outbound: number }) => s + m.outbound, 0)).toBe(2);
  });

  it('CSV export requires reports:export', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const pm = await createStaff('PRODUCT_MANAGER'); // reports:view only
    const csv = await api().get('/api/v1/admin/reports/sales?range=7d&format=csv').set(auth(admin.token));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text.split('\r\n')[0]).toContain('Net sales');
    expect(csv.text.trim().split('\r\n')).toHaveLength(8);
    expect((await api().get('/api/v1/admin/reports/sales?range=7d').set(auth(pm.token))).status).toBe(200);
    expect((await api().get('/api/v1/admin/reports/sales?range=7d&format=csv').set(auth(pm.token))).status).toBe(403);
    const support = await createStaff('SUPPORT_MANAGER');
    expect((await api().get('/api/v1/admin/reports/sales').set(auth(support.token))).status).toBe(403);
  });
});

describe('inventory administration', () => {
  beforeEach(resetData);

  it('adjusts stock through the core: movement + audit, rejects removing more than in stock or going below reserved', async () => {
    const im = await createStaff('INVENTORY_MANAGER');
    const p = await createProduct({ stock: 5 });
    const v = p.variants[0].id;

    const add = await api().post(`/api/v1/admin/inventory/${v}/adjust`).set(auth(im.token)).send({ mode: 'add', quantity: 10, reason: 'RESTOCK', note: 'Supplier delivery' });
    expect(add.status).toBe(200);
    expect(add.body.data.item).toMatchObject({ stock: 15, available: 15, status: 'IN_STOCK' });
    expect(add.body.data.movement).toMatchObject({ change: 10, previousStock: 5, newStock: 15, reason: 'RESTOCK', adminId: im.userId });
    expect(add.body.data.movement.adminName).toBe('Staff INVENTORY_MANAGER');

    const tooMany = await api().post(`/api/v1/admin/inventory/${v}/adjust`).set(auth(im.token)).send({ mode: 'remove', quantity: 16, reason: 'DAMAGED' });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.message).toMatch(/only 15 in stock/);

    const noNote = await api().post(`/api/v1/admin/inventory/${v}/adjust`).set(auth(im.token)).send({ mode: 'remove', quantity: 1, reason: 'OTHER' });
    expect(noNote.status).toBe(400);
    const badReason = await api().post(`/api/v1/admin/inventory/${v}/adjust`).set(auth(im.token)).send({ mode: 'add', quantity: 1, reason: 'ORDER' });
    expect(badReason.status).toBe(400);

    // Reserve 3 with an order; stock cannot be set below that.
    const c = await registerCustomer();
    await placeOrder(c.token, c.user.id, v, 3);
    expect(await stockOf(v)).toEqual({ stock_quantity: 15, reserved_quantity: 3 });
    const below = await api().patch(`/api/v1/admin/inventory/${v}`).set(auth(im.token)).send({ stockQuantity: 2 });
    expect(below.status).toBe(409);
    const set = await api().patch(`/api/v1/admin/inventory/${v}`).set(auth(im.token)).send({ stockQuantity: 4, lowStockThreshold: 3, reason: 'manual_correction' });
    expect(set.status).toBe(200);
    expect(set.body.data.item).toMatchObject({ stock: 4, reserved: 3, available: 1, threshold: 3, status: 'LOW_STOCK' });

    const threshold = await api().patch(`/api/v1/admin/inventory/${v}`).set(auth(im.token)).send({ lowStockThreshold: 0 });
    expect(threshold.body.data.item.threshold).toBe(0);
    expect(threshold.body.data.movement).toBeNull();

    // Alias used by the admin UI.
    const alias = await api().post('/api/v1/admin/inventory/adjustments').set(auth(im.token)).send({ variantId: p.variants[1].id, mode: 'remove', quantity: 5, reason: 'damaged', notes: 'Water damage' });
    expect(alias.status).toBe(200);
    expect(alias.body.data.item.status).toBe('OUT_OF_STOCK');

    const moves = await api().get(`/api/v1/admin/inventory/movements?variant=${v}`).set(auth(im.token));
    expect(moves.body.data.map((m: { reason: string }) => m.reason)).toEqual(['MANUAL_ADJUSTMENT', 'RESTOCK']);
    expect(moves.body.data[0]).toMatchObject({ sku: p.variants[0].sku, variantLabel: 'Black / 41', adminName: 'Staff INVENTORY_MANAGER' });
    expect(moves.body.pagination.total).toBe(2);

    const logs = await query<{ action: string; entity_id: string }>(`select action, entity_id from public.admin_activity_logs where action = 'Stock adjusted' order by created_at`);
    expect(logs).toHaveLength(3);
  });

  it('lists variants with status filters, summary counts and pagination', async () => {
    const admin = await createStaff('ADMIN');
    const p = await createProduct({ stock: 10, sizes: ['40', '41', '42'] });
    await query(`update public.inventory set stock_quantity = 1 where variant_id = $1`, [p.variants[1].id]);
    await query(`update public.inventory set stock_quantity = 0 where variant_id = $1`, [p.variants[2].id]);

    const all = await api().get('/api/v1/admin/inventory?limit=2').set(auth(admin.token));
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.pagination).toMatchObject({ total: 3, totalPages: 2, hasNext: true });
    expect(all.body.summary).toMatchObject({ total: 3, inStock: 1, lowStock: 1, outOfStock: 1, units: 11 });

    const low = await api().get('/api/v1/admin/inventory/low-stock').set(auth(admin.token));
    expect(low.body.data.map((i: { sku: string }) => i.sku)).toEqual([p.variants[1].sku]);
    const out = await api().get('/api/v1/admin/inventory?status=out_of_stock').set(auth(admin.token));
    expect(out.body.data.map((i: { sku: string }) => i.sku)).toEqual([p.variants[2].sku]);
    const search = await api().get(`/api/v1/admin/inventory?search=${p.variants[0].sku}`).set(auth(admin.token));
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0]).toMatchObject({ productId: p.productId, color: 'Black', colorHex: '#141414', size: '40' });
  });

  it('INVENTORY_MANAGER can adjust stock but cannot see payment settings or customers', async () => {
    const im = await createStaff('INVENTORY_MANAGER');
    const p = await createProduct({ stock: 2 });
    expect((await api().post(`/api/v1/admin/inventory/${p.variants[0].id}/adjust`).set(auth(im.token)).send({ mode: 'add', quantity: 1, reason: 'RESTOCK' })).status).toBe(200);
    expect((await api().get('/api/v1/admin/settings/payments').set(auth(im.token))).status).toBe(403);
    expect((await api().get('/api/v1/admin/customers').set(auth(im.token))).status).toBe(403);
    const so = await createStaff('SUPPORT_MANAGER');
    expect((await api().post(`/api/v1/admin/inventory/${p.variants[0].id}/adjust`).set(auth(so.token)).send({ mode: 'add', quantity: 1, reason: 'RESTOCK' })).status).toBe(403);
  });

  it('activity log records stock adjustments with the admin name and filters by module', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const p = await createProduct({ stock: 2 });
    await api().post(`/api/v1/admin/inventory/${p.variants[0].id}/adjust`).set(auth(admin.token)).send({ mode: 'add', quantity: 4, reason: 'RESTOCK' });
    const logs = await api().get('/api/v1/admin/activity-logs?module=inventory').set(auth(admin.token));
    expect(logs.status).toBe(200);
    expect(logs.body.data).toHaveLength(1);
    expect(logs.body.data[0]).toMatchObject({ action: 'Stock adjusted', module: 'inventory', adminId: admin.userId, adminName: 'Staff SUPER_ADMIN', status: 'SUCCESS', record: p.variants[0].sku });
    expect(logs.body.data[0].metadata).toMatchObject({ previous: 2, next: 6, change: 4 });
    const none = await api().get('/api/v1/admin/activity-logs?module=coupon').set(auth(admin.token));
    expect(none.body.data).toHaveLength(0);
    const searched = await api().get(`/api/v1/admin/activity-logs?search=${p.variants[0].sku}`).set(auth(admin.token));
    expect(searched.body.pagination.total).toBe(1);
    const im = await createStaff('INVENTORY_MANAGER');
    expect((await api().get('/api/v1/admin/activity-logs').set(auth(im.token))).status).toBe(403);
    const row = await queryOne<{ n: number }>(`select count(*)::int as n from public.inventory_movements where admin_id = $1`, [admin.userId]);
    expect(row!.n).toBe(1);
  });
});
