import { z } from 'zod';
import type { Request } from 'express';
import type { PoolClient } from 'pg';
import { query, queryOne, withTransaction, type Db, pool } from '../../config/database.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { adminListQuery, offsetOf } from '../../utils/pagination.js';
import { randomToken } from '../../utils/http.js';
import { audit } from '../../services/audit.service.js';
import { provisionUser } from '../auth/provisioning.js';
import { invalidateAuthContext } from '../auth/auth.context.js';
import { revokeAllSessions } from '../auth/tokens.js';
import { credentials } from '../auth/providers/index.js';
import { iso, upperEnum } from '../reports/zod-helpers.js';

/**
 * Staff = users holding at least one role with is_staff. Accounts are created with a random
 * throw-away password and a password-reset email, so nobody (including the inviting admin)
 * ever knows the new user's password.
 *
 * Guard rails:
 *  - only a SUPER_ADMIN may grant, change or remove the SUPER_ADMIN role or manage a super admin;
 *  - there must always be at least one ACTIVE super admin;
 *  - nobody can deactivate or change the role of their own account.
 */
const SUPER = 'SUPER_ADMIN';

interface StaffRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  last_login_at: Date | null;
  created_at: Date;
  roles: { id: string; slug: string; name: string }[];
}

const SELECT = `select u.id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.status, u.last_login_at, u.created_at,
    (select json_agg(json_build_object('id', r.id, 'slug', r.slug, 'name', r.name) order by r.slug)
       from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = u.id and r.is_staff) as roles
  from public.users u
  where u.deleted_at is null
    and exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = u.id and r.is_staff)`;

function toStaff(r: StaffRow) {
  const roles = r.roles ?? [];
  const primary = roles.find((x) => x.slug === SUPER) ?? roles[0];
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    name: `${r.first_name} ${r.last_name}`.trim(),
    email: r.email,
    phone: r.phone,
    avatarUrl: r.avatar_url,
    roles,
    roleId: primary?.id ?? null,
    roleSlug: primary?.slug ?? null,
    roleName: primary?.name ?? null,
    status: r.status,
    /** Invited = never signed in yet. */
    invited: !r.last_login_at,
    lastLoginAt: iso(r.last_login_at),
    createdAt: iso(r.created_at)!,
  };
}

export async function getStaff(id: string, db: Db = pool) {
  const r = await queryOne<StaffRow>(`${SELECT} and u.id = $1`, [id], db);
  if (!r) throw notFound('Admin user');
  return toStaff(r);
}

export const staffListQuery = adminListQuery(['created_at', 'name', 'email', 'last_login_at']).extend({
  status: upperEnum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  role: z.string().trim().max(40).optional(),
});

export async function listStaff(f: z.infer<typeof staffListQuery>) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (f.search) add(`((u.first_name || ' ' || u.last_name) ilike ? or u.email ilike ?)`, `%${f.search}%`);
  if (f.status) add('u.status = ?::public.user_status', f.status);
  if (f.role) add(`exists (select 1 from public.user_roles ur2 join public.roles r2 on r2.id = ur2.role_id where ur2.user_id = u.id and (r2.slug = upper(?) or r2.id::text = ?))`, f.role);
  const extra = where.length ? ` and ${where.join(' and ')}` : '';
  const sort: Record<string, string> = { created_at: 'u.created_at', name: 'lower(u.first_name || u.last_name)', email: 'lower(u.email)', last_login_at: 'u.last_login_at' };
  const n = params.length;
  const rows = await query<StaffRow>(`${SELECT}${extra} order by ${sort[f.sort ?? 'created_at']} ${f.order} nulls last, u.id limit $${n + 1} offset $${n + 2}`, [
    ...params,
    f.limit,
    offsetOf(f.page, f.limit),
  ]);
  const total = await queryOne<{ n: number }>(`select count(*)::int as n from (${SELECT}${extra}) s`, params);
  return { rows: rows.map(toStaff), total: total!.n };
}

async function staffRole(slugOrId: string, db: Db = pool) {
  const r = await queryOne<{ id: string; slug: string; name: string; is_staff: boolean }>(
    `select id, slug, name, is_staff from public.roles where slug = upper($1) or id::text = $1`,
    [slugOrId],
    db,
  );
  if (!r || !r.is_staff) throw badRequest('Unknown staff role.', { roleSlug: slugOrId });
  return r;
}

const isSuper = (req: Request) => req.auth!.roles.includes(SUPER);

async function activeSuperAdmins(db: Db, excludeUserId?: string) {
  const r = await queryOne<{ n: number }>(
    `select count(distinct u.id)::int as n from public.users u join public.user_roles ur on ur.user_id = u.id join public.roles r on r.id = ur.role_id
      where r.slug = '${SUPER}' and u.status = 'ACTIVE' and u.deleted_at is null and ($1::uuid is null or u.id <> $1::uuid)`,
    [excludeUserId ?? null],
    db,
  );
  return r!.n;
}

async function lockSuperAdmins(tx: PoolClient) {
  // Serialises concurrent role/status changes so two admins cannot demote the last two super admins at once.
  await query(`select id from public.roles where slug = '${SUPER}' for update`, [], tx);
}

// ─── Invite ─────────────────────────────────────────────────────────────────

export const inviteBody = z
  .object({
    email: z.string().trim().toLowerCase().email().max(160),
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(2).max(160).optional(),
    phone: z.string().trim().max(30).regex(/^[+0-9 ()-]*$/, 'Invalid phone number.').nullable().optional(),
    roleSlug: z.string().trim().max(60).optional(),
    roleId: z.string().trim().max(60).optional(),
  })
  .transform((b) => {
    // The admin UI sends a single "name"; split it when first/last are not given.
    if ((!b.firstName || !b.lastName) && b.name) {
      const [first, ...rest] = b.name.split(/\s+/);
      return { ...b, firstName: b.firstName ?? first, lastName: b.lastName ?? (rest.join(' ') || first) };
    }
    return b;
  })
  .refine((b) => b.firstName && b.lastName, { message: 'First and last name are required.', path: ['firstName'] })
  .refine((b) => b.roleSlug || b.roleId, { message: 'A role is required.', path: ['roleSlug'] });

export async function inviteStaff(req: Request, b: z.infer<typeof inviteBody>) {
  const role = await staffRole((b.roleSlug ?? b.roleId)!);
  if (role.slug === SUPER && !isSuper(req)) throw forbidden('Only a Super Admin can create another Super Admin.');
  const existing = await queryOne<{ id: string; staff: boolean }>(
    `select u.id, exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = u.id and r.is_staff) as staff
       from public.users u where lower(u.email) = lower($1) and u.deleted_at is null`,
    [b.email],
  );
  if (existing?.staff) throw conflict('An admin with this email already exists.');

  // Random password nobody sees; the user sets their own through the reset email.
  const { userId, created } = await provisionUser({
    email: b.email,
    password: `${randomToken(24)}Aa1!`,
    firstName: b.firstName!,
    lastName: b.lastName!,
    phone: b.phone ?? null,
    roleSlug: role.slug,
    verified: true,
  });
  invalidateAuthContext(userId);
  const user = await queryOne<{ id: string; email: string; first_name: string }>(`select id, email, first_name from public.users where id = $1`, [userId]);
  await credentials.sendPasswordReset({ id: user!.id, email: user!.email, firstName: user!.first_name }, user!.email, { app: 'admin' });
  await audit(req, { action: 'Admin invited', entityType: 'staff', entityId: userId, metadata: { email: b.email, role: role.slug, existingAccount: !created } });
  return getStaff(userId);
}

// ─── Update ─────────────────────────────────────────────────────────────────

export const updateBody = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(2).max(160).optional(),
    phone: z.string().trim().max(30).regex(/^[+0-9 ()-]*$/, 'Invalid phone number.').nullable().optional(),
    roleSlug: z.string().trim().max(60).optional(),
    roleId: z.string().trim().max(60).optional(),
  })
  .transform((b) => {
    if (b.name && !b.firstName && !b.lastName) {
      const [first, ...rest] = b.name.split(/\s+/);
      return { ...b, firstName: first, lastName: rest.join(' ') || first };
    }
    return b;
  });

export async function updateStaff(req: Request, id: string, b: z.infer<typeof updateBody>) {
  const target = await getStaff(id);
  const targetIsSuper = target.roles.some((r) => r.slug === SUPER);
  if (targetIsSuper && !isSuper(req) && id !== req.auth!.userId) throw forbidden('Only a Super Admin can edit a Super Admin account.');
  const roleKey = b.roleSlug ?? b.roleId;
  const newRole = roleKey ? await staffRole(roleKey) : null;
  const roleChanges = newRole && !(target.roles.length === 1 && target.roles[0].id === newRole.id);

  await withTransaction(async (tx) => {
    await query(
      `update public.users set first_name = coalesce($2, first_name), last_name = coalesce($3, last_name),
              phone = case when $4 then nullif($5, '') else phone end where id = $1`,
      [id, b.firstName ?? null, b.lastName ?? null, b.phone !== undefined, b.phone ?? null],
      tx,
    );
    if (roleChanges && newRole) {
      if (id === req.auth!.userId) throw forbidden('You cannot change your own role.');
      if ((newRole.slug === SUPER || targetIsSuper) && !isSuper(req)) throw forbidden('Only a Super Admin can grant or remove the Super Admin role.');
      if (targetIsSuper && newRole.slug !== SUPER) {
        await lockSuperAdmins(tx);
        if (target.status === 'ACTIVE' && (await activeSuperAdmins(tx, id)) === 0) throw new AppError('CONFLICT', 'At least one active Super Admin is required.');
      }
      // Replace staff roles; a CUSTOMER role (storefront account) is kept.
      await query(`delete from public.user_roles ur using public.roles r where ur.role_id = r.id and ur.user_id = $1 and r.is_staff`, [id], tx);
      await query(`insert into public.user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`, [id, newRole.id], tx);
    }
    await audit(
      req,
      {
        action: roleChanges ? 'Admin role changed' : 'Admin updated',
        entityType: 'staff',
        entityId: id,
        metadata: { email: target.email, ...(roleChanges ? { from: target.roles.map((r) => r.slug), to: newRole!.slug } : {}), fields: Object.keys(b) },
      },
      tx,
    );
  });
  invalidateAuthContext(id);
  return getStaff(id);
}

// ─── Status / access ────────────────────────────────────────────────────────

export const staffStatusBody = z.object({
  // Admin UI uses active / deactivated.
  status: z.preprocess((v) => (typeof v === 'string' ? ({ deactivated: 'INACTIVE', invited: 'ACTIVE' } as Record<string, string>)[v.toLowerCase()] ?? v.toUpperCase() : v), z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED'])),
  reason: z.string().trim().max(500).optional().nullable(),
});

export async function setStaffStatus(req: Request, id: string, b: z.infer<typeof staffStatusBody>) {
  const target = await getStaff(id);
  if (id === req.auth!.userId && b.status !== 'ACTIVE') throw forbidden('You cannot deactivate your own account.');
  const targetIsSuper = target.roles.some((r) => r.slug === SUPER);
  if (targetIsSuper && !isSuper(req)) throw forbidden('Only a Super Admin can change a Super Admin account.');
  if (target.status === b.status) return target;
  await withTransaction(async (tx) => {
    if (targetIsSuper && b.status !== 'ACTIVE') {
      await lockSuperAdmins(tx);
      if ((await activeSuperAdmins(tx, id)) === 0) throw new AppError('CONFLICT', 'You cannot deactivate the last active Super Admin.');
    }
    await query(`update public.users set status = $2::public.user_status where id = $1`, [id, b.status], tx);
    if (b.status !== 'ACTIVE') await revokeAllSessions(id, undefined, tx);
    await audit(
      req,
      {
        action: b.status === 'ACTIVE' ? 'Admin reactivated' : 'Admin deactivated',
        entityType: 'staff',
        entityId: id,
        metadata: { email: target.email, from: target.status, to: b.status, reason: b.reason ?? null },
      },
      tx,
    );
  });
  invalidateAuthContext(id);
  return getStaff(id);
}

/** Signs the user out everywhere and emails a password-reset link. */
export async function resetAccess(req: Request, id: string) {
  const target = await getStaff(id);
  if (target.roles.some((r) => r.slug === SUPER) && !isSuper(req) && id !== req.auth!.userId) throw forbidden('Only a Super Admin can reset a Super Admin account.');
  await revokeAllSessions(id);
  invalidateAuthContext(id);
  if (target.status === 'ACTIVE') await credentials.sendPasswordReset({ id, email: target.email, firstName: target.firstName }, target.email, { app: 'admin' });
  await audit(req, { action: 'Admin access reset', entityType: 'staff', entityId: id, metadata: { email: target.email, emailSent: target.status === 'ACTIVE' } });
  return { sessionsRevoked: true, resetEmailSent: target.status === 'ACTIVE' };
}

