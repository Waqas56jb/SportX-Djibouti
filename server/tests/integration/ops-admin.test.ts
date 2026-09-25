import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { address, api, auth, createProduct, createStaff, PASSWORD, putInCart, registerCustomer, resetData } from '../helpers/fixtures.js';
import { query, queryOne } from '../../src/config/database.js';

type Outbox = { outbox: { to: string; subject: string; text: string }[] };
async function outbox() {
  const { emailService } = await import('../../src/services/email/email.service.js');
  return (emailService.provider as unknown as Outbox).outbox;
}

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe('customers', () => {
  beforeEach(resetData);

  it('lists customers with stats and groups, filters, and shows a detail view', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const p = await createProduct({ price: 50000, stock: 10 });
    const big = await registerCustomer({ firstName: 'Hodan' });
    const quiet = await registerCustomer({ firstName: 'Ayan' });
    await query(`update public.users set created_at = now() - interval '90 days' where id = $1`, [quiet.user.id]);
    await query(`insert into public.addresses (user_id, first_name, last_name, phone, address_line_1, city, is_default) values ($1, 'A', 'B', '+253 77', 'Rue 1', 'Arta', true)`, [quiet.user.id]);

    for (let i = 0; i < 2; i++) {
      await putInCart(big.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
      const o = (await api().post('/api/v1/orders').set(auth(big.token)).send({ shippingMethod: 'pickup', paymentMethod: 'CASH_ON_DELIVERY', address })).body.data;
      for (const status of ['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']) await api().patch(`/api/v1/admin/orders/${o.id}/status`).set(auth(admin.token)).send({ status });
    }

    const list = await api().get('/api/v1/admin/customers?sort=total_spent&order=desc').set(auth(admin.token));
    expect(list.status).toBe(200);
    expect(list.body.pagination.total).toBe(2); // staff are not customers
    expect(list.body.data[0]).toMatchObject({ id: big.user.id, ordersCount: 2, totalSpent: 100000, averageOrder: 50000 });
    expect(list.body.data[0].groups).toEqual(expect.arrayContaining(['new', 'returning', 'high_value']));
    expect(list.body.data[1].groups).toEqual(['inactive']);

    const hv = await api().get('/api/v1/admin/customers?group=high_value').set(auth(admin.token));
    expect(hv.body.data.map((c: { id: string }) => c.id)).toEqual([big.user.id]);
    const inactive = await api().get('/api/v1/admin/customers?group=inactive').set(auth(admin.token));
    expect(inactive.body.data.map((c: { id: string }) => c.id)).toEqual([quiet.user.id]);
    const city = await api().get('/api/v1/admin/customers?city=arta').set(auth(admin.token));
    expect(city.body.data).toHaveLength(1);
    const search = await api().get(`/api/v1/admin/customers?search=${encodeURIComponent(big.email)}`).set(auth(admin.token));
    expect(search.body.data).toHaveLength(1);
    const phone = await api().get('/api/v1/admin/customers?search=77000000').set(auth(admin.token));
    expect(phone.body.data).toHaveLength(2);

    const groups = await api().get('/api/v1/admin/customers/groups').set(auth(admin.token));
    const byId = Object.fromEntries(groups.body.data.map((g: { id: string; count: number; revenue: number }) => [g.id, g]));
    expect(byId.all.count).toBe(2);
    expect(byId.high_value).toMatchObject({ count: 1, revenue: 100000 });

    const detail = await api().get(`/api/v1/admin/customers/${big.user.id}`).set(auth(admin.token));
    expect(detail.status).toBe(200);
    expect(detail.body.data.stats).toMatchObject({ ordersCount: 2, totalSpent: 100000 });
    expect(detail.body.data.recentOrders).toHaveLength(2);
    expect(detail.body.data.activity.map((a: { type: string }) => a.type)).toEqual(expect.arrayContaining(['account_created', 'order_placed', 'order_status']));
    const orders = await api().get(`/api/v1/admin/customers/${big.user.id}/orders?limit=1`).set(auth(admin.token));
    expect(orders.body.pagination).toMatchObject({ total: 2, totalPages: 2 });
    expect((await api().get(`/api/v1/admin/customers/${admin.userId}`).set(auth(admin.token))).status).toBe(404);

    const upd = await api().patch(`/api/v1/admin/customers/${big.user.id}`).set(auth(admin.token)).send({ notes: 'VIP', marketingOptIn: true, email: 'ignored@example.com' });
    expect(upd.body.data).toMatchObject({ notes: 'VIP', marketingOptIn: true, email: big.email });
  });

  it('blocking a customer revokes sessions, rejects their token and blocks login', async () => {
    const admin = await createStaff('SUPPORT_MANAGER'); // customers:edit
    const c = await registerCustomer();
    expect((await api().get('/api/v1/orders').set(auth(c.token))).status).toBe(200);

    const res = await api().patch(`/api/v1/admin/customers/${c.user.id}/status`).set(auth(admin.token)).send({ status: 'blocked', reason: 'Fraudulent chargebacks' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('BLOCKED');
    const live = await queryOne<{ n: number }>(`select count(*)::int as n from public.auth_sessions where user_id = $1 and revoked_at is null`, [c.user.id]);
    expect(live!.n).toBe(0);
    const denied = await api().get('/api/v1/orders').set(auth(c.token));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('ACCOUNT_INACTIVE');
    const login = await api().post('/api/v1/auth/login').send({ email: c.email, password: PASSWORD });
    expect(login.status).toBe(403);

    const log = await queryOne<{ metadata: Record<string, unknown> }>(`select metadata from public.admin_activity_logs where action = 'Customer status changed' and entity_id = $1`, [c.user.id]);
    expect(log!.metadata).toMatchObject({ from: 'ACTIVE', to: 'BLOCKED', reason: 'Fraudulent chargebacks' });
    const activity = await api().get(`/api/v1/admin/customers/${c.user.id}/activity`).set(auth(admin.token));
    expect(activity.body.data[0]).toMatchObject({ type: 'status_changed', title: 'Customer status changed' });

    await api().patch(`/api/v1/admin/customers/${c.user.id}/status`).set(auth(admin.token)).send({ status: 'ACTIVE' }).expect(200);
    expect((await api().post('/api/v1/auth/login').send({ email: c.email, password: PASSWORD })).status).toBe(200);

    const om = await createStaff('ORDER_MANAGER'); // customers:view only
    expect((await api().patch(`/api/v1/admin/customers/${c.user.id}/status`).set(auth(om.token)).send({ status: 'BLOCKED' })).status).toBe(403);
  });
});

describe('coupons, discounts, flash sales and campaigns', () => {
  beforeEach(resetData);

  it('validates coupons on create and derives their status', async () => {
    const admin = await createStaff('ADMIN');
    const p = await createProduct();
    const post = (body: Record<string, unknown>) => api().post('/api/v1/admin/coupons').set(auth(admin.token)).send(body);

    expect((await post({ code: 'BIG', type: 'percentage', value: 150 })).status).toBe(400);
    const dates = await post({ code: 'DATES', type: 'FIXED', value: 500, startsAt: future(5), endsAt: future(1) });
    expect(dates.status).toBe(400);
    expect(dates.body.error.details.endsAt).toBeTruthy();
    expect((await post({ code: 'x!', type: 'FIXED', value: 500 })).status).toBe(400);
    expect((await post({ code: 'GHOST', type: 'FIXED', value: 500, productIds: ['00000000-0000-4000-8000-000000000000'] })).status).toBe(400);

    const ok = await post({ code: 'save10', type: 'percentage', value: 10, minOrder: 5000, maxDiscount: 3000, productIds: [p.productId], customerGroups: ['new'] });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ code: 'SAVE10', type: 'PERCENTAGE', value: 10, minOrder: 5000, status: 'active', enabled: true, usageCount: 0 });
    expect((await post({ code: 'Save10', type: 'FIXED', value: 100 })).status).toBe(409);

    await post({ code: 'LATER', type: 'FIXED', value: 100, startsAt: future(3) });
    const off = await api().patch(`/api/v1/admin/coupons/${ok.body.data.id}`).set(auth(admin.token)).send({ enabled: false });
    expect(off.body.data.status).toBe('disabled');
    expect((await api().patch(`/api/v1/admin/coupons/${ok.body.data.id}`).set(auth(admin.token)).send({ type: 'PERCENTAGE', value: 101 })).status).toBe(400);

    const scheduled = await api().get('/api/v1/admin/coupons?status=scheduled').set(auth(admin.token));
    expect(scheduled.body.data.map((c: { code: string }) => c.code)).toEqual(['LATER']);
    expect(scheduled.body.counts).toMatchObject({ all: 2, scheduled: 1, disabled: 1 });

    await api().delete(`/api/v1/admin/coupons/${ok.body.data.id}`).set(auth(admin.token)).expect(200);
    const all = await api().get('/api/v1/admin/coupons').set(auth(admin.token));
    expect(all.body.data.map((c: { code: string }) => c.code)).toEqual(['LATER']);
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.coupons where deleted_at is not null`))!.n).toBe(1);
    // The code is reusable after a soft delete.
    expect((await post({ code: 'SAVE10', type: 'FIXED', value: 100 })).status).toBe(201);
    const usages = await api().get(`/api/v1/admin/coupons/${ok.body.data.id}/usages`).set(auth(admin.token));
    expect(usages.body.data).toEqual([]);
    const logs = await query<{ action: string }>(`select action from public.admin_activity_logs where entity_type = 'coupon' order by created_at`);
    expect(logs.map((l) => l.action)).toEqual(['Coupon created', 'Coupon created', 'Coupon disabled', 'Coupon deleted', 'Coupon created']);
  });

  it('discount targets must exist; flash sales compute sales in their window; campaigns take a banner', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const p = await createProduct({ price: 10000 });

    const badTarget = await api().post('/api/v1/admin/discounts').set(auth(admin.token)).send({ name: 'Boots', type: 'PERCENTAGE', value: 10, appliesTo: 'products', targetIds: ['00000000-0000-4000-8000-000000000000'] });
    expect(badTarget.status).toBe(400);
    const noTargets = await api().post('/api/v1/admin/discounts').set(auth(admin.token)).send({ name: 'Boots', type: 'PERCENTAGE', value: 10, appliesTo: 'CATEGORIES' });
    expect(noTargets.status).toBe(400);
    const disc = await api().post('/api/v1/admin/discounts').set(auth(admin.token)).send({ name: 'Boots', type: 'PERCENTAGE', value: 10, appliesTo: 'products', targetIds: [p.productId] });
    expect(disc.status).toBe(201);
    expect(disc.body.data).toMatchObject({ appliesTo: 'PRODUCTS', status: 'active', targets: [{ id: p.productId }] });
    const toggled = await api().put(`/api/v1/admin/discounts/${disc.body.data.id}`).set(auth(admin.token)).send({ enabled: false });
    expect(toggled.body.data.status).toBe('disabled');

    expect((await api().post('/api/v1/admin/flash-sales').set(auth(admin.token)).send({ name: 'Weekend', discountPercent: 20, productIds: [p.productId], startsAt: future(2), endsAt: future(1) })).status).toBe(400);
    expect((await api().post('/api/v1/admin/flash-sales').set(auth(admin.token)).send({ name: 'Weekend', discountPercent: 95, productIds: [p.productId], startsAt: future(-1), endsAt: future(1) })).status).toBe(400);
    const fs = await api().post('/api/v1/admin/flash-sales').set(auth(admin.token)).send({ name: 'Weekend', discountPercent: 20, productIds: [p.productId], startsAt: future(-1), endsAt: future(1) });
    expect(fs.status).toBe(201);
    expect(fs.body.data).toMatchObject({ status: 'active', unitsSold: 0, revenue: 0 });
    const c = await registerCustomer();
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 2 }]);
    await api().post('/api/v1/orders').set(auth(c.token)).send({ shippingMethod: 'pickup', paymentMethod: 'CASH_ON_DELIVERY', address }).expect(201);
    const fs2 = await api().get(`/api/v1/admin/flash-sales/${fs.body.data.id}`).set(auth(admin.token));
    expect(fs2.body.data.unitsSold).toBe(2);
    expect(fs2.body.data.revenue).toBeGreaterThan(0);
    const upcoming = await api().get('/api/v1/admin/flash-sales?status=upcoming').set(auth(admin.token));
    expect(upcoming.body.data).toHaveLength(0);

    const camp = await api().post('/api/v1/admin/campaigns').set(auth(admin.token)).send({ name: 'Back to school', type: 'seasonal', startsAt: future(-1), endsAt: future(10), productIds: [p.productId] });
    expect(camp.status).toBe(201);
    expect(camp.body.data).toMatchObject({ status: 'DRAFT', unitsSold: 2 });
    const act = await api().patch(`/api/v1/admin/campaigns/${camp.body.data.id}/status`).set(auth(admin.token)).send({ status: 'active' });
    expect(act.body.data.status).toBe('ACTIVE');
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const banner = await api().post(`/api/v1/admin/campaigns/${camp.body.data.id}/banner`).set(auth(admin.token)).attach('file', png, { filename: 'b.png', contentType: 'image/png' });
    expect(banner.status).toBe(200);
    expect(banner.body.data.bannerUrl).toContain(`/uploads/campaigns/${camp.body.data.id}/`);
    const fake = await api().post(`/api/v1/admin/campaigns/${camp.body.data.id}/banner`).set(auth(admin.token)).attach('file', Buffer.from('not an image at all'), { filename: 'x.png', contentType: 'image/png' });
    expect(fake.status).toBe(415);
    await api().delete(`/api/v1/admin/campaigns/${camp.body.data.id}`).set(auth(admin.token)).expect(200);

    const pm = await createStaff('PRODUCT_MANAGER'); // no discounts:* permissions
    expect((await api().get('/api/v1/admin/coupons').set(auth(pm.token))).status).toBe(403);
  });
});

describe('settings, shipping and payment settings', () => {
  beforeEach(resetData);
  // Shipping configuration is reference data shared with other test files — restore it.
  afterEach(async () => {
    await query(`update public.shipping_methods set price = 1000, is_active = true where code = 'standard'`);
    await query(`delete from public.shipping_zones where name <> 'Djibouti'`);
  });

  it('updates store settings (visible to the storefront immediately) and uploads a logo', async () => {
    const admin = await createStaff('ADMIN');
    const res = await api().patch('/api/v1/admin/settings').set(auth(admin.token)).send({ freeShippingThreshold: 30000, orderPrefix: 'sx', email: 'help@sportx.dj', notificationSettings: { lowStockEmail: true } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ freeShippingThreshold: 30000, orderPrefix: 'SX', supportEmail: 'help@sportx.dj', notificationSettings: { lowStockEmail: true } });
    expect((await api().get('/api/v1/store')).body.data.freeShippingThreshold).toBe(30000);
    expect((await api().patch('/api/v1/admin/settings').set(auth(admin.token)).send({ taxRate: 150 })).status).toBe(400);
    expect((await api().patch('/api/v1/admin/settings').set(auth(admin.token)).send({ timezone: 'Mars/Olympus' })).status).toBe(400);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const logo = await api().post('/api/v1/admin/settings/logo').set(auth(admin.token)).attach('file', png, { filename: 'l.png', contentType: 'image/png' });
    expect(logo.body.data.logoUrl).toContain('/uploads/store/logo/');
    const prefs = await api().put('/api/v1/admin/settings/notifications').set(auth(admin.token)).send([{ event: 'LOW_STOCK', channels: { email: true, sms: false, in_app: true } }]);
    expect(prefs.status).toBe(200);
    expect((await api().get('/api/v1/admin/settings/notifications').set(auth(admin.token))).body.data[0].event).toBe('LOW_STOCK');
    const om = await createStaff('ORDER_MANAGER');
    expect((await api().patch('/api/v1/admin/settings').set(auth(om.token)).send({ tagline: 'x' })).status).toBe(403);
  });

  it('manages shipping zones and methods; checkout sees the new price', async () => {
    const admin = await createStaff('ADMIN');
    const list = await api().get('/api/v1/admin/shipping').set(auth(admin.token));
    expect(list.body.data[0].methods.map((m: { code: string }) => m.code)).toEqual(['standard', 'express', 'pickup']);
    const standard = list.body.data[0].methods[0];
    const upd = await api().patch(`/api/v1/admin/shipping/${standard.id}`).set(auth(admin.token)).send({ price: 1500 });
    expect(upd.body.data).toMatchObject({ price: 1500, estimatedDelivery: '2–4 days' });
    const pub = await api().get('/api/v1/shipping/methods');
    expect(pub.body.data.methods.find((m: { code: string }) => m.code === 'standard').price).toBe(1500);

    const zone = await api().post('/api/v1/admin/shipping/zones').set(auth(admin.token)).send({ name: 'Regions', regions: ['Obock'] });
    expect(zone.status).toBe(201);
    const m = await api().post('/api/v1/admin/settings/shipping/methods').set(auth(admin.token)).send({ zoneId: zone.body.data.id, name: 'Regional Courier', price: 3000, estimatedDelivery: '3-5 days' });
    expect(m.status).toBe(201);
    expect(m.body.data).toMatchObject({ code: 'regional-courier', minDays: 3, maxDays: 5 });
    expect((await api().post('/api/v1/admin/shipping/methods').set(auth(admin.token)).send({ zoneId: zone.body.data.id, name: 'Bad', price: 1, minDays: 5, maxDays: 2 })).status).toBe(400);
    await api().patch(`/api/v1/admin/shipping/methods/${m.body.data.id}`).set(auth(admin.token)).send({ enabled: false }).expect(200);
    await api().delete(`/api/v1/admin/shipping/zones/${zone.body.data.id}`).set(auth(admin.token)).expect(200);
    expect((await queryOne<{ n: number }>(`select count(*)::int as n from public.shipping_methods where zone_id = $1`, [zone.body.data.id]))!.n).toBe(0);
  });

  it('payment settings report configuration without ever returning secret values', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const res = await api().get('/api/v1/admin/settings/payments').set(auth(admin.token));
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(process.env.JWT_SECRET!);
    expect(text).not.toMatch(/sk_(test|live)_|whsec_|mock:/);
    const byId = Object.fromEntries(res.body.data.providers.map((p: { id: string }) => [p.id, p]));
    expect(byId.cash_on_delivery).toMatchObject({ enabled: true, configured: true, webhookUrl: null });
    expect(byId.mock).toMatchObject({ enabled: true, mode: 'test', webhookUrl: expect.stringMatching(/\/api\/v1\/payments\/webhook\/mock$/) });
    expect(byId.stripe).toMatchObject({ enabled: false, configured: false, mode: null });
    for (const p of res.body.data.providers) for (const f of p.fields) expect(Object.keys(f).sort()).toEqual(['configured', 'key', 'label', 'required', 'secret']);
  });
});

describe('staff and roles', () => {
  beforeEach(resetData);

  it('invites staff without exposing a password and sends a reset email', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const res = await api().post('/api/v1/admin/staff').set(auth(admin.token)).send({ email: 'New.Admin@Example.com', firstName: 'Amina', lastName: 'Farah', roleSlug: 'ORDER_MANAGER' });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('password');
    expect(res.body.data).toMatchObject({ email: 'new.admin@example.com', roleSlug: 'ORDER_MANAGER', status: 'ACTIVE', invited: true });
    const mail = [...(await outbox())].reverse().find((m) => m.to === 'new.admin@example.com');
    expect(mail?.text).toMatch(/reset-password\?token=/);
    expect((await api().post('/api/v1/admin/staff').set(auth(admin.token)).send({ email: 'new.admin@example.com', name: 'Dup Admin', roleSlug: 'ADMIN' })).status).toBe(409);
    expect((await api().post('/api/v1/admin/staff').set(auth(admin.token)).send({ email: 'x@example.com', name: 'Bad Role', roleSlug: 'CUSTOMER' })).status).toBe(400);

    // An ADMIN has no settings:create; nobody but a super admin can mint super admins.
    const plain = await createStaff('ADMIN');
    expect((await api().post('/api/v1/admin/staff').set(auth(plain.token)).send({ email: 'y@example.com', name: 'Y Y', roleSlug: 'SUPER_ADMIN' })).status).toBe(403);

    const list = await api().get('/api/v1/admin/admin-users').set(auth(admin.token));
    expect(list.body.pagination.total).toBe(3);
    const reset = await api().post(`/api/v1/admin/staff/${res.body.data.id}/reset-access`).set(auth(admin.token));
    expect(reset.body.data).toEqual({ sessionsRevoked: true, resetEmailSent: true });
  });

  it('protects super admins: no self-deactivation, no demoting the last one, no changes by lesser admins', async () => {
    const sa = await createStaff('SUPER_ADMIN');
    const admin = await createStaff('ADMIN');
    expect((await api().patch(`/api/v1/admin/staff/${sa.userId}/status`).set(auth(sa.token)).send({ status: 'deactivated' })).status).toBe(403);
    expect((await api().patch(`/api/v1/admin/staff/${sa.userId}`).set(auth(sa.token)).send({ roleSlug: 'ADMIN' })).status).toBe(403);
    expect((await api().patch(`/api/v1/admin/staff/${sa.userId}/status`).set(auth(admin.token)).send({ status: 'INACTIVE' })).status).toBe(403);

    // Two super admins: one may demote the other, but then the last one cannot be demoted.
    const sa2 = await createStaff('SUPER_ADMIN');
    const demote = await api().patch(`/api/v1/admin/staff/${sa2.userId}`).set(auth(sa.token)).send({ roleSlug: 'ADMIN' });
    expect(demote.status).toBe(200);
    expect(demote.body.data.roleSlug).toBe('ADMIN');
    const { invalidateAuthContext } = await import('../../src/modules/auth/auth.context.js');
    // Simulate a race: sa2 still carries a cached SUPER_ADMIN context and tries to demote sa (now the last one).
    await query(`insert into public.user_roles (user_id, role_id) select $1, id from public.roles where slug = 'SUPER_ADMIN'`, [sa2.userId]);
    invalidateAuthContext(sa2.userId);
    await api().get('/api/v1/admin/staff').set(auth(sa2.token)).expect(200); // context now cached as super admin
    await query(`delete from public.user_roles ur using public.roles r where ur.role_id = r.id and ur.user_id = $1 and r.slug = 'SUPER_ADMIN'`, [sa2.userId]);
    const last = await api().patch(`/api/v1/admin/staff/${sa.userId}/status`).set(auth(sa2.token)).send({ status: 'INACTIVE' });
    expect(last.status).toBe(409);
    expect(last.body.error.message).toMatch(/last active Super Admin/);

    // Deactivating an ordinary admin revokes their sessions and locks them out.
    const off = await api().patch(`/api/v1/admin/staff/${admin.userId}/status`).set(auth(sa.token)).send({ status: 'deactivated' });
    expect(off.body.data.status).toBe('INACTIVE');
    expect((await api().get('/api/v1/admin/dashboard').set(auth(admin.token))).status).toBe(403);
  });

  it('roles: SUPER_ADMIN is immutable; custom role permissions apply on the next request', async () => {
    const sa = await createStaff('SUPER_ADMIN');
    const superRole = (await api().get('/api/v1/admin/roles').set(auth(sa.token))).body.data.find((r: { slug: string }) => r.slug === 'SUPER_ADMIN');
    expect(superRole.permissions.length).toBeGreaterThan(40);
    expect((await api().patch(`/api/v1/admin/roles/${superRole.id}`).set(auth(sa.token)).send({ permissions: ['dashboard:view'] })).status).toBe(403);
    expect((await api().delete(`/api/v1/admin/roles/${superRole.id}`).set(auth(sa.token))).status).toBe(403);

    const perms = await api().get('/api/v1/admin/permissions').set(auth(sa.token));
    expect(perms.body.data.find((g: { module: string }) => g.module === 'inventory').permissions.map((p: { key: string }) => p.key)).toContain('inventory:edit');

    expect((await api().post('/api/v1/admin/roles').set(auth(sa.token)).send({ name: 'Bad', permissions: ['nope:view'] })).status).toBe(400);
    const role = await api().post('/api/v1/admin/roles').set(auth(sa.token)).send({ name: 'Stock Viewer', description: 'Read-only stock', permissions: ['inventory:view'] });
    expect(role.status).toBe(201);
    expect(role.body.data).toMatchObject({ slug: 'STOCK_VIEWER', isSystem: false, permissions: ['inventory:view'], userCount: 0 });

    const staff = await createStaff('SUPPORT_MANAGER');
    await api().patch(`/api/v1/admin/staff/${staff.userId}`).set(auth(sa.token)).send({ roleSlug: 'STOCK_VIEWER' }).expect(200);
    expect((await api().get('/api/v1/admin/inventory').set(auth(staff.token))).status).toBe(200);
    expect((await api().get('/api/v1/admin/customers').set(auth(staff.token))).status).toBe(403);

    await api().patch(`/api/v1/admin/roles/${role.body.data.id}`).set(auth(sa.token)).send({ permissions: ['inventory:view', 'customers:view'] }).expect(200);
    expect((await api().get('/api/v1/admin/customers').set(auth(staff.token))).status).toBe(200);

    expect((await api().delete(`/api/v1/admin/roles/${role.body.data.id}`).set(auth(sa.token))).status).toBe(409);
    const adminRole = (await api().get('/api/v1/admin/roles').set(auth(sa.token))).body.data.find((r: { slug: string }) => r.slug === 'ADMIN');
    expect((await api().delete(`/api/v1/admin/roles/${adminRole.id}`).set(auth(sa.token))).status).toBe(403);

    // A non-super admin cannot grant permissions they do not hold.
    const admin = await createStaff('ADMIN');
    const escalate = await api().patch(`/api/v1/admin/roles/${role.body.data.id}`).set(auth(admin.token)).send({ permissions: ['inventory:view', 'settings:delete'] });
    expect(escalate.status).toBe(403);

    await api().patch(`/api/v1/admin/staff/${staff.userId}`).set(auth(sa.token)).send({ roleSlug: 'SUPPORT_MANAGER' }).expect(200);
    await api().delete(`/api/v1/admin/roles/${role.body.data.id}`).set(auth(sa.token)).expect(200);
    const actions = await query<{ action: string }>(`select action from public.admin_activity_logs where entity_type = 'role' order by created_at`);
    expect(actions.map((a) => a.action)).toEqual(['Role created', 'Role permissions updated', 'Role deleted']);
  });

  it('global search is filtered by the caller’s permissions', async () => {
    const sa = await createStaff('SUPER_ADMIN');
    const p = await createProduct();
    const c = await registerCustomer({ firstName: 'Zahra' });
    await putInCart(c.user.id, [{ variantId: p.variants[0].id, quantity: 1 }]);
    const order = (await api().post('/api/v1/orders').set(auth(c.token)).send({ shippingMethod: 'pickup', paymentMethod: 'CASH_ON_DELIVERY', address }).expect(201)).body.data;

    const all = await api().get(`/api/v1/admin/search?q=${encodeURIComponent(c.email)}`).set(auth(sa.token));
    expect(all.body.data.map((r: { group: string }) => r.group).sort()).toEqual(['customers', 'orders']);
    const sku = await api().get(`/api/v1/admin/search?q=${p.variants[0].sku}`).set(auth(sa.token));
    expect(sku.body.data[0]).toMatchObject({ group: 'products', id: p.productId });
    const byNumber = await api().get(`/api/v1/admin/search?q=${order.orderNumber}`).set(auth(sa.token));
    expect(byNumber.body.data.some((r: { group: string }) => r.group === 'orders')).toBe(true);

    const im = await createStaff('INVENTORY_MANAGER'); // products yes; orders/customers no
    const limited = await api().get(`/api/v1/admin/search?q=${encodeURIComponent(c.email)}`).set(auth(im.token));
    expect(limited.body.data).toEqual([]);
    const products = await api().get('/api/v1/admin/search?q=boot').set(auth(im.token));
    expect(products.body.data.every((r: { group: string }) => r.group === 'products' || r.group === 'categories')).toBe(true);
    expect((await api().get('/api/v1/admin/search?q=a').set(auth(sa.token))).body.data).toEqual([]);
  });
});
