import { beforeEach, describe, expect, it } from 'vitest';
import { api, auth, createStaff, PASSWORD, registerCustomer, resetData } from '../helpers/fixtures.js';
import { queryOne } from '../../src/config/database.js';

const cookieFrom = (setCookie: string[] | string | undefined, name: string) =>
  ([] as string[]).concat(setCookie ?? []).find((c) => c.startsWith(`${name}=`))?.split(';')[0];

describe('customer authentication', () => {
  beforeEach(resetData);

  it('registers a customer, hashes the password and assigns the CUSTOMER role', async () => {
    const { user, token } = await registerCustomer({ email: 'hodan@example.com' });
    expect(token).toBeTruthy();
    const cred = await queryOne<{ password_hash: string }>(`select password_hash from public.auth_credentials where user_id = $1`, [user.id]);
    expect(cred!.password_hash).toMatch(/^scrypt\$/);
    expect(cred!.password_hash).not.toContain(PASSWORD);
    const role = await queryOne<{ slug: string }>(`select r.slug from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = $1`, [user.id]);
    expect(role!.slug).toBe('CUSTOMER');
  });

  it('rejects duplicate emails case-insensitively and weak passwords', async () => {
    await registerCustomer({ email: 'dup@example.com' });
    const dup = await api().post('/api/v1/auth/register').send({ firstName: 'A', lastName: 'B', email: 'DUP@example.com', password: PASSWORD });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
    const weak = await api().post('/api/v1/auth/register').send({ firstName: 'A', lastName: 'B', email: 'weak@example.com', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in, sets an HttpOnly refresh cookie, rotates it and revokes it on logout', async () => {
    const { email } = await registerCustomer();
    const login = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(login.body)).not.toContain('refresh');
    const raw = ([] as string[]).concat(login.headers['set-cookie'] ?? []);
    expect(raw.join(';')).toMatch(/sportx_rt=.*HttpOnly/i);
    const rt1 = cookieFrom(raw, 'sportx_rt')!;

    const refreshed = await api().post('/api/v1/auth/refresh').set('Cookie', rt1);
    expect(refreshed.status).toBe(200);
    const rt2 = cookieFrom(refreshed.headers['set-cookie'], 'sportx_rt')!;
    expect(rt2).not.toBe(rt1);

    // Re-using a rotated token is rejected (and revokes the family).
    const reuse = await api().post('/api/v1/auth/refresh').set('Cookie', rt1);
    expect(reuse.status).toBe(401);

    const again = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    const rt3 = cookieFrom(again.headers['set-cookie'], 'sportx_rt')!;
    await api().post('/api/v1/auth/logout').set('Cookie', rt3).expect(200);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', rt3)).status).toBe(401);
  });

  it('uses one generic message for unknown email and wrong password', async () => {
    const { email } = await registerCustomer();
    const wrong = await api().post('/api/v1/auth/login').send({ email, password: 'Wrong1234' });
    const unknown = await api().post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'Wrong1234' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('blocks blocked accounts even with a valid token', async () => {
    const { token, user } = await registerCustomer();
    await queryOne(`update public.users set status = 'BLOCKED' where id = $1`, [user.id]);
    const { invalidateAuthContext } = await import('../../src/modules/auth/auth.context.js');
    invalidateAuthContext(user.id);
    const me = await api().get('/api/v1/auth/me').set(auth(token));
    expect(me.status).toBe(403);
    expect(me.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('resets a password with a one-time token and signs out other sessions', async () => {
    const { email, user } = await registerCustomer();
    await api().post('/api/v1/auth/forgot-password').send({ email }).expect(200);
    // Unknown emails get the same response (no account enumeration).
    await api().post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' }).expect(200);
    const { emailService } = await import('../../src/services/email/email.service.js');
    const outbox = (emailService.provider as unknown as { outbox: { to: string; text: string }[] }).outbox;
    const mail = [...outbox].reverse().find((m) => m.to === email && m.text.includes('reset-password'));
    const token = mail!.text.match(/token=([A-Za-z0-9_-]+)/)![1];

    await api().post('/api/v1/auth/reset-password').send({ token, password: 'NewPassw0rd' }).expect(200);
    expect((await api().post('/api/v1/auth/reset-password').send({ token, password: 'Another1pw' })).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email, password: PASSWORD })).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email, password: 'NewPassw0rd' })).status).toBe(200);
    const live = await queryOne<{ n: number }>(`select count(*)::int as n from public.auth_sessions where user_id = $1 and revoked_at is null`, [user.id]);
    expect(live!.n).toBe(1); // only the session created by the login above
  });
});

describe('admin authorization', () => {
  beforeEach(resetData);

  it('refuses admin login for customers and admin APIs for customer-scoped tokens', async () => {
    const { email, token } = await registerCustomer();
    const res = await api().post('/api/v1/admin/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(403);
    const orders = await api().get('/api/v1/admin/orders').set(auth(token));
    expect(orders.status).toBe(403);
  });

  it('returns roles and permissions from the database and enforces per-route permissions', async () => {
    const support = await createStaff('SUPPORT_MANAGER');
    const me = await api().get('/api/v1/admin/auth/me').set(auth(support.token));
    expect(me.status).toBe(200);
    expect(me.body.data.roles.map((r: { slug: string }) => r.slug)).toEqual(['SUPPORT_MANAGER']);
    expect(me.body.data.permissions).toContain('orders:view');
    expect(me.body.data.permissions).not.toContain('orders:approve');

    const list = await api().get('/api/v1/admin/orders').set(auth(support.token));
    expect(list.status).toBe(200);
    const refund = await api().post('/api/v1/admin/orders/00000000-0000-0000-0000-000000000000/refund').set(auth(support.token)).send({ type: 'full', reason: 'OTHER' });
    expect(refund.status).toBe(403);
  });

  it('keeps admin and storefront tokens separate, except for self-service profile routes', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    expect((await api().get('/api/v1/cart').set(auth(admin.token))).status).toBe(403);
    expect((await api().get('/api/v1/orders').set(auth(admin.token))).status).toBe(403);
    expect((await api().get('/api/v1/users/me').set(auth(admin.token))).status).toBe(200);
    const bad = await api().get('/api/v1/admin/orders').query({ date_from: 'not-a-date' }).set(auth(admin.token));
    expect(bad.status).toBe(400);
  });

  it('records admin sign-ins in the activity log', async () => {
    const admin = await createStaff('SUPER_ADMIN');
    const log = await queryOne<{ action: string }>(`select action from public.admin_activity_logs where admin_id = $1 order by created_at desc limit 1`, [admin.userId]);
    expect(log!.action).toBe('Admin signed in');
  });
});
