import { Router, type Request } from 'express';
import { z } from 'zod';
import { query, queryOne, withTransaction, type Db, pool } from '../../config/database.js';
import { asyncHandler } from '../../utils/http.js';
import { created, noContent, ok } from '../../utils/apiResponse.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, uuidParam } from '../../middleware/validation.middleware.js';
import { audit } from '../../services/audit.service.js';
import { invalidateAuthContext } from '../auth/auth.context.js';
import { iso } from '../reports/zod-helpers.js';

/**
 * Roles & permissions. Permission checks read role_permissions on every request (via the auth
 * context, cache invalidated here), so changes apply on the user's next request.
 * - SUPER_ADMIN is immutable; the CUSTOMER role cannot receive permissions.
 * - System roles keep their slug and cannot be deleted; custom roles can be deleted when unused.
 * - Non-super-admins can only grant permissions they hold themselves (no privilege escalation).
 */
const SUPER = 'SUPER_ADMIN';

interface RoleRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_system: boolean;
  is_staff: boolean;
  permissions: string[] | null;
  user_count: number;
  created_at: Date;
  updated_at: Date;
}

const SELECT = `select r.*, (select array_agg(rp.permission_key order by rp.permission_key) from public.role_permissions rp where rp.role_id = r.id) as permissions,
    (select count(*)::int from public.user_roles ur join public.users u on u.id = ur.user_id where ur.role_id = r.id and u.deleted_at is null) as user_count
  from public.roles r`;

const toRole = (r: RoleRow) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description,
  isSystem: r.is_system,
  isStaff: r.is_staff,
  immutable: r.slug === SUPER,
  permissions: r.permissions ?? [],
  userCount: r.user_count,
  createdAt: iso(r.created_at)!,
  updatedAt: iso(r.updated_at)!,
});

async function loadRole(id: string, db: Db = pool) {
  const r = await queryOne<RoleRow>(`${SELECT} where r.id::text = $1 or r.slug = $1`, [id], db);
  if (!r) throw notFound('Role');
  return r;
}

async function assertPermissionsExist(keys: string[]) {
  const unique = [...new Set(keys)];
  if (!unique.length) return unique;
  const found = new Set((await query<{ key: string }>(`select key from public.permissions where key = any($1::text[])`, [unique])).map((r) => r.key));
  const missing = unique.filter((k) => !found.has(k));
  if (missing.length) throw badRequest('Unknown permissions.', { permissions: missing });
  return unique;
}

function assertCanGrant(req: Request, added: string[]) {
  if (req.auth!.roles.includes(SUPER)) return;
  const denied = added.filter((k) => !req.auth!.permissions.has(k));
  if (denied.length) throw forbidden(`You cannot grant permissions you do not have: ${denied.join(', ')}.`);
}

/** /api/v1/admin/roles */
export const rolesRouter = Router();

rolesRouter.get(
  '/',
  requirePermission('settings:view'),
  asyncHandler(async (_req, res) => {
    const rows = await query<RoleRow>(`${SELECT} where r.is_staff order by r.is_system desc, (r.slug = '${SUPER}') desc, r.name`);
    return ok(res, rows.map(toRole));
  }),
);

rolesRouter.get('/:id', requirePermission('settings:view'), asyncHandler(async (req, res) => ok(res, toRole(await loadRole(req.params.id)))));

const roleBody = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  slug: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, ''))
    .pipe(z.string().regex(/^[A-Z][A-Z0-9_]{1,40}$/, 'Slug must start with a letter.'))
    .optional(),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.string().trim().regex(/^[a-z_]+:[a-z_]+$/)).max(200).optional(),
});

rolesRouter.post(
  '/',
  requirePermission('settings:create'),
  validate({ body: roleBody }),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof roleBody>;
    if (!b.name) throw badRequest('Role name is required.');
    const slug = b.slug ?? b.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!/^[A-Z][A-Z0-9_]{1,40}$/.test(slug)) throw badRequest('Choose a name that starts with a letter.', { name: b.name });
    const perms = await assertPermissionsExist(b.permissions ?? []);
    assertCanGrant(req, perms);
    const taken = await queryOne(`select 1 from public.roles where slug = $1 or lower(name) = lower($2)`, [slug, b.name]);
    if (taken) throw conflict('A role with this name already exists.');
    const id = await withTransaction(async (tx) => {
      const r = await queryOne<{ id: string }>(
        `insert into public.roles (slug, name, description, is_system, is_staff) values ($1, $2, $3, false, true) returning id`,
        [slug, b.name, b.description ?? ''],
        tx,
      );
      if (perms.length) await query(`insert into public.role_permissions (role_id, permission_key) select $1, unnest($2::text[])`, [r!.id, perms], tx);
      await audit(req, { action: 'Role created', entityType: 'role', entityId: r!.id, metadata: { slug, name: b.name, permissions: perms } }, tx);
      return r!.id;
    });
    return created(res, toRole(await loadRole(id)), 'Role created.');
  }),
);

async function updateRole(req: Request, id: string, b: z.infer<typeof roleBody>) {
  const role = await loadRole(id);
  if (role.slug === SUPER) throw forbidden('The Super Admin role cannot be modified.');
  if (!role.is_staff) throw forbidden('This role cannot be modified.');
  if (b.slug && b.slug !== role.slug) {
    if (role.is_system) throw forbidden('System role slugs cannot be changed.');
    if (await queryOne(`select 1 from public.roles where slug = $1 and id <> $2`, [b.slug, role.id])) throw conflict('A role with this slug already exists.');
  }
  if (b.name && (await queryOne(`select 1 from public.roles where lower(name) = lower($1) and id <> $2`, [b.name, role.id]))) throw conflict('A role with this name already exists.');
  const before = role.permissions ?? [];
  const next = b.permissions ? await assertPermissionsExist(b.permissions) : before;
  const added = next.filter((k) => !before.includes(k));
  const removed = before.filter((k) => !next.includes(k));
  assertCanGrant(req, added);
  // Prevent locking yourself out of role management through your own role.
  if (req.auth!.roles.includes(role.slug) && !req.auth!.roles.includes(SUPER) && removed.some((k) => k === 'settings:view' || k === 'settings:edit'))
    throw new AppError('CONFLICT', 'You cannot remove role-management permissions from your own role.');

  await withTransaction(async (tx) => {
    await query(
      `update public.roles set name = coalesce($2, name), description = coalesce($3, description), slug = coalesce($4, slug) where id = $1`,
      [role.id, b.name ?? null, b.description ?? null, role.is_system ? null : b.slug ?? null],
      tx,
    );
    if (b.permissions) {
      await query(`delete from public.role_permissions where role_id = $1`, [role.id], tx);
      if (next.length) await query(`insert into public.role_permissions (role_id, permission_key) select $1, unnest($2::text[])`, [role.id, next], tx);
    }
    await audit(
      req,
      { action: added.length || removed.length ? 'Role permissions updated' : 'Role updated', entityType: 'role', entityId: role.id, metadata: { slug: role.slug, added, removed } },
      tx,
    );
  });
  invalidateAuthContext();
  return toRole(await loadRole(role.id));
}

for (const method of ['patch', 'put'] as const) {
  rolesRouter[method](
    '/:id',
    requirePermission('settings:edit'),
    validate({ params: uuidParam(), body: roleBody }),
    asyncHandler(async (req, res) => ok(res, await updateRole(req, req.params.id, req.body), 'Role updated.')),
  );
}

rolesRouter.delete(
  '/:id',
  requirePermission('settings:delete'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    const role = await loadRole(req.params.id);
    if (role.is_system) throw forbidden('Default roles cannot be deleted.');
    if (role.user_count > 0) throw conflict('Reassign the admins using this role before deleting it.', { userCount: role.user_count });
    await withTransaction(async (tx) => {
      await query(`delete from public.roles where id = $1`, [role.id], tx);
      await audit(req, { action: 'Role deleted', entityType: 'role', entityId: role.id, metadata: { slug: role.slug, name: role.name } }, tx);
    });
    invalidateAuthContext();
    return noContent(res, 'Role deleted.');
  }),
);

/** /api/v1/admin/permissions — the catalogue, grouped by module. */
export const permissionsRouter = Router();

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  categories: 'Categories & brands',
  inventory: 'Inventory',
  orders: 'Orders',
  customers: 'Customers',
  reviews: 'Reviews',
  discounts: 'Marketing & discounts',
  reports: 'Reports',
  support: 'Support',
  settings: 'Settings, admin users & roles',
};

permissionsRouter.get(
  '/',
  requirePermission('settings:view'),
  asyncHandler(async (_req, res) => {
    const rows = await query<{ key: string; module: string; action: string; description: string }>(`select key, module, action, description from public.permissions order by module, action`);
    const order = Object.keys(MODULE_LABELS);
    const groups = new Map<string, { module: string; label: string; permissions: { key: string; action: string; description: string }[] }>();
    for (const r of rows) {
      const g = groups.get(r.module) ?? { module: r.module, label: MODULE_LABELS[r.module] ?? r.module, permissions: [] };
      g.permissions.push({ key: r.key, action: r.action, description: r.description });
      groups.set(r.module, g);
    }
    const list = [...groups.values()].sort((a, b) => (order.indexOf(a.module) + 1 || 99) - (order.indexOf(b.module) + 1 || 99));
    return ok(res, list);
  }),
);
