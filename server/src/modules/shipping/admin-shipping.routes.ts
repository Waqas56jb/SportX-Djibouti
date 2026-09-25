import { Router, type Request } from 'express';
import { z } from 'zod';
import { query, queryOne, withTransaction, type Db } from '../../config/database.js';
import { asyncHandler } from '../../utils/http.js';
import { created, noContent, ok } from '../../utils/apiResponse.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { slugify } from '../../utils/slug.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, uuidParam } from '../../middleware/validation.middleware.js';
import { audit } from '../../services/audit.service.js';

/**
 * /api/v1/admin/shipping (also mounted at /settings/shipping for the admin UI).
 * Zones group regions; methods belong to a zone. Checkout reads active methods of active zones.
 */
export const adminShippingRouter = Router();

interface MethodRow {
  id: string;
  zone_id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  free_shipping_threshold: number | null;
  min_days: number;
  max_days: number;
  requires_address: boolean;
  carrier: string | null;
  is_active: boolean;
  sort_order: number;
  updated_at: Date;
}

const toMethod = (m: MethodRow) => ({
  id: m.id,
  zoneId: m.zone_id,
  code: m.code,
  name: m.name,
  description: m.description,
  price: m.price,
  freeShippingThreshold: m.free_shipping_threshold,
  minDays: m.min_days,
  maxDays: m.max_days,
  estimatedDelivery: m.min_days === m.max_days ? `${m.min_days} day${m.min_days === 1 ? '' : 's'}` : `${m.min_days}–${m.max_days} days`,
  requiresAddress: m.requires_address,
  carrier: m.carrier,
  enabled: m.is_active,
  sortOrder: m.sort_order,
  updatedAt: new Date(m.updated_at).toISOString(),
});

async function zones(db?: Db) {
  const zs = await query<{ id: string; name: string; regions: string[]; is_active: boolean; sort_order: number; updated_at: Date }>(
    `select id, name, regions, is_active, sort_order, updated_at from public.shipping_zones order by sort_order, name`,
    [],
    db,
  );
  const ms = await query<MethodRow>(`select * from public.shipping_methods order by sort_order, name`, [], db);
  return zs.map((z) => ({
    id: z.id,
    name: z.name,
    regions: z.regions,
    enabled: z.is_active,
    sortOrder: z.sort_order,
    updatedAt: new Date(z.updated_at).toISOString(),
    methods: ms.filter((m) => m.zone_id === z.id).map(toMethod),
  }));
}

async function method(id: string) {
  const m = await queryOne<MethodRow>(`select * from public.shipping_methods where id = $1`, [id]);
  if (!m) throw notFound('Shipping method');
  return toMethod(m);
}

for (const path of ['/', '/zones']) {
  adminShippingRouter.get(path, requirePermission('settings:view'), asyncHandler(async (_req, res) => ok(res, await zones())));
}

// ─── Zones ──────────────────────────────────────────────────────────────────

const zoneBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  regions: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

adminShippingRouter.post(
  '/zones',
  requirePermission('settings:edit'),
  validate({ body: zoneBody }),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof zoneBody>;
    if (!b.name) throw badRequest('Zone name is required.');
    const id = await withTransaction(async (tx) => {
      const r = await queryOne<{ id: string }>(
        `insert into public.shipping_zones (name, regions, is_active, sort_order)
         values ($1, $2::text[], $3, coalesce($4, (select coalesce(max(sort_order), -1) + 1 from public.shipping_zones))) returning id`,
        [b.name, [...new Set(b.regions ?? [])], b.enabled ?? true, b.sortOrder ?? null],
        tx,
      );
      await audit(req, { action: 'Shipping zone created', entityType: 'shipping_zone', entityId: r!.id, metadata: { name: b.name } }, tx);
      return r!.id;
    });
    return created(res, (await zones()).find((z) => z.id === id), 'Shipping zone created.');
  }),
);

for (const m of ['patch', 'put'] as const) {
  adminShippingRouter[m](
    '/zones/:id',
    requirePermission('settings:edit'),
    validate({ params: uuidParam(), body: zoneBody }),
    asyncHandler(async (req, res) => {
      const b = req.body as z.infer<typeof zoneBody>;
      await withTransaction(async (tx) => {
        const r = await queryOne<{ name: string }>(
          `update public.shipping_zones set name = coalesce($2, name), regions = coalesce($3::text[], regions), is_active = coalesce($4, is_active),
                  sort_order = coalesce($5, sort_order) where id = $1 returning name`,
          [req.params.id, b.name ?? null, b.regions ? [...new Set(b.regions)] : null, b.enabled ?? null, b.sortOrder ?? null],
          tx,
        );
        if (!r) throw notFound('Shipping zone');
        await audit(req, { action: 'Shipping zone updated', entityType: 'shipping_zone', entityId: req.params.id, metadata: { name: r.name, fields: Object.keys(b) } }, tx);
      });
      return ok(res, (await zones()).find((z) => z.id === req.params.id), 'Shipping zone updated.');
    }),
  );
}

adminShippingRouter.delete(
  '/zones/:id',
  requirePermission('settings:edit'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    await withTransaction(async (tx) => {
      const r = await queryOne<{ name: string }>(`delete from public.shipping_zones where id = $1 returning name`, [req.params.id], tx);
      if (!r) throw notFound('Shipping zone');
      await audit(req, { action: 'Shipping zone deleted', entityType: 'shipping_zone', entityId: req.params.id, metadata: { name: r.name } }, tx);
    });
    return noContent(res, 'Shipping zone deleted.');
  }),
);

// ─── Methods ────────────────────────────────────────────────────────────────

const methodBody = z.object({
  zoneId: z.string().uuid().optional(),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,40}$/, 'Use lower-case letters, digits, "-" or "_".').optional(),
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  price: z.number().int().min(0).max(10_000_000).optional(),
  freeShippingThreshold: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  minDays: z.number().int().min(0).max(90).optional(),
  maxDays: z.number().int().min(0).max(90).optional(),
  estimatedDelivery: z.string().trim().max(40).optional(),
  requiresAddress: z.boolean().optional(),
  carrier: z.string().trim().max(80).nullable().optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
type MethodBody = z.infer<typeof methodBody>;

/** "2–4 days" / "1 day" → { min, max } when explicit minDays/maxDays are not given. */
function parseEstimate(s?: string): { min?: number; max?: number } {
  const m = s?.match(/(\d+)\s*(?:[-–]|to)\s*(\d+)/) ?? s?.match(/(\d+)/);
  if (!m) return {};
  return { min: Number(m[1]), max: Number(m[2] ?? m[1]) };
}

async function uniqueCode(base: string, excludeId?: string) {
  const root = (slugify(base) || 'method').slice(0, 36);
  for (let i = 1; i < 100; i++) {
    const code = i === 1 ? root : `${root}-${i}`;
    const taken = await queryOne(`select 1 from public.shipping_methods where code = $1 and ($2::uuid is null or id <> $2::uuid)`, [code, excludeId ?? null]);
    if (!taken) return code;
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function saveMethod(req: Request, b: MethodBody, id?: string) {
  const cur = id ? await queryOne<MethodRow>(`select * from public.shipping_methods where id = $1`, [id]) : null;
  if (id && !cur) throw notFound('Shipping method');
  const est = parseEstimate(b.estimatedDelivery);
  const s = {
    zone_id: b.zoneId ?? cur?.zone_id,
    name: b.name ?? cur?.name,
    description: b.description ?? cur?.description ?? '',
    price: b.price ?? cur?.price,
    free_shipping_threshold: b.freeShippingThreshold !== undefined ? b.freeShippingThreshold : cur?.free_shipping_threshold ?? null,
    min_days: b.minDays ?? est.min ?? cur?.min_days ?? 1,
    max_days: b.maxDays ?? est.max ?? cur?.max_days ?? 3,
    requires_address: b.requiresAddress ?? cur?.requires_address ?? true,
    carrier: b.carrier !== undefined ? b.carrier : cur?.carrier ?? null,
    is_active: b.enabled ?? cur?.is_active ?? true,
    sort_order: b.sortOrder ?? cur?.sort_order ?? 0,
    code: b.code ?? cur?.code,
  };
  const errors: Record<string, string> = {};
  if (!s.zone_id) errors.zoneId = 'Zone is required.';
  if (!s.name) errors.name = 'Name is required.';
  if (s.price === undefined) errors.price = 'Price is required.';
  if (s.max_days < s.min_days) errors.maxDays = 'Maximum days cannot be less than minimum days.';
  if (Object.keys(errors).length) throw badRequest('Shipping method validation failed.', errors);
  const zone = await queryOne(`select 1 from public.shipping_zones where id = $1`, [s.zone_id]);
  if (!zone) throw badRequest('Unknown shipping zone.', { zoneId: s.zone_id });
  if (b.code) {
    const taken = await queryOne(`select 1 from public.shipping_methods where code = $1 and ($2::uuid is null or id <> $2::uuid)`, [b.code, id ?? null]);
    if (taken) throw conflict(`Shipping method code "${b.code}" is already used.`);
  }
  const code = s.code ?? (await uniqueCode(s.name!));
  const vals = [s.zone_id, code, s.name, s.description, s.price, s.free_shipping_threshold, s.min_days, s.max_days, s.requires_address, s.carrier, s.is_active, s.sort_order];
  return withTransaction(async (tx) => {
    let methodId = id;
    if (id) {
      await query(
        `update public.shipping_methods set zone_id = $1, code = $2, name = $3, description = $4, price = $5, free_shipping_threshold = $6,
                min_days = $7, max_days = $8, requires_address = $9, carrier = $10, is_active = $11, sort_order = $12 where id = $13`,
        [...vals, id],
        tx,
      );
    } else {
      const r = await queryOne<{ id: string }>(
        `insert into public.shipping_methods (zone_id, code, name, description, price, free_shipping_threshold, min_days, max_days, requires_address, carrier, is_active, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
        vals,
        tx,
      );
      methodId = r!.id;
    }
    const onlyToggle = id && Object.keys(b).length === 1 && b.enabled !== undefined;
    await audit(
      req,
      {
        action: !id ? 'Shipping method created' : onlyToggle ? (s.is_active ? 'Shipping method enabled' : 'Shipping method disabled') : 'Shipping method updated',
        entityType: 'shipping_method',
        entityId: methodId,
        metadata: { name: s.name, code, price: s.price, ...(cur && cur.price !== s.price ? { previousPrice: cur.price } : {}) },
      },
      tx,
    );
    return methodId!;
  });
}

adminShippingRouter.post(
  '/methods',
  requirePermission('settings:edit'),
  validate({ body: methodBody }),
  asyncHandler(async (req, res) => created(res, await method(await saveMethod(req, req.body)), 'Shipping method created.')),
);

// PATCH /methods/:id, PUT /methods/:id and PATCH /:id (method) all update a method.
for (const [m, path] of [['patch', '/methods/:id'], ['put', '/methods/:id'], ['patch', '/:id']] as const) {
  adminShippingRouter[m](
    path,
    requirePermission('settings:edit'),
    validate({ params: uuidParam(), body: methodBody }),
    asyncHandler(async (req, res) => ok(res, await method(await saveMethod(req, req.body, req.params.id)), 'Shipping method updated.')),
  );
}

adminShippingRouter.delete(
  '/methods/:id',
  requirePermission('settings:edit'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    await withTransaction(async (tx) => {
      const r = await queryOne<{ name: string; code: string }>(`delete from public.shipping_methods where id = $1 returning name, code`, [req.params.id], tx);
      if (!r) throw notFound('Shipping method');
      await audit(req, { action: 'Shipping method deleted', entityType: 'shipping_method', entityId: req.params.id, metadata: { name: r.name, code: r.code } }, tx);
    });
    return noContent(res, 'Shipping method deleted.');
  }),
);
