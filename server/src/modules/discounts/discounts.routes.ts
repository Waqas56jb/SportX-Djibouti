import { Router, type Request } from 'express';
import { z } from 'zod';
import { query, queryOne, withTransaction } from '../../config/database.js';
import { asyncHandler } from '../../utils/http.js';
import { created, noContent, ok, paginated } from '../../utils/apiResponse.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { adminListQuery, offsetOf, pageMeta } from '../../utils/pagination.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, query as q, uuidParam } from '../../middleware/validation.middleware.js';
import { audit } from '../../services/audit.service.js';
import { isoDate, iso, lowerEnum, upperEnum } from '../reports/zod-helpers.js';
import { assertTargetsExist, PROMOTION_STATUSES, promotionStatusSql } from './targets.js';

/** Automatic (code-less) catalogue discounts. Pricing picks them up in priceCart. */
const SCOPES = ['ALL', 'PRODUCTS', 'CATEGORIES', 'BRANDS'] as const;
type Scope = (typeof SCOPES)[number];
const TARGET_TABLE = { PRODUCTS: 'products', CATEGORIES: 'categories', BRANDS: 'brands' } as const;

interface Row {
  id: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  applies_to: Scope;
  target_ids: string[];
  starts_at: Date;
  ends_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  status: string;
  targets: { id: string; name: string }[] | null;
}

const SELECT = `select d.*, ${promotionStatusSql('d')} as status,
  (select coalesce(json_agg(json_build_object('id', t.id, 'name', t.name)), '[]'::json) from (
     select id, name from public.products where d.applies_to = 'PRODUCTS' and id = any(d.target_ids)
     union all select id, name from public.categories where d.applies_to = 'CATEGORIES' and id = any(d.target_ids)
     union all select id, name from public.brands where d.applies_to = 'BRANDS' and id = any(d.target_ids)) t) as targets
  from public.discounts d`;

const toDiscount = (r: Row) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  value: r.value,
  appliesTo: r.applies_to,
  targetIds: r.target_ids,
  targets: r.targets ?? [],
  startsAt: iso(r.starts_at)!,
  endsAt: iso(r.ends_at),
  enabled: r.is_active,
  status: r.status,
  createdAt: iso(r.created_at)!,
  updatedAt: iso(r.updated_at)!,
});

async function load(id: string) {
  const r = await queryOne<Row>(`${SELECT} where d.id = $1`, [id]);
  if (!r) throw notFound('Discount');
  return toDiscount(r);
}

const body = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  type: upperEnum(['PERCENTAGE', 'FIXED']).optional(),
  value: z.number().int().positive().max(1_000_000_000).optional(),
  appliesTo: upperEnum([...SCOPES]).optional(),
  targetIds: z.array(z.string().uuid()).max(500).optional(),
  startsAt: isoDate().optional(),
  endsAt: isoDate().nullable().optional(),
  enabled: z.boolean().optional(),
});
type Body = z.infer<typeof body>;

interface State {
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  applies_to: Scope;
  target_ids: string[];
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
}

async function build(b: Body, cur?: State): Promise<State> {
  const s: State = {
    name: b.name ?? cur?.name ?? '',
    type: (b.type ?? cur?.type) as State['type'],
    value: (b.value ?? cur?.value) as number,
    applies_to: b.appliesTo ?? cur?.applies_to ?? 'ALL',
    target_ids: b.targetIds ?? (b.appliesTo && b.appliesTo !== cur?.applies_to ? [] : cur?.target_ids ?? []),
    starts_at: b.startsAt ?? cur?.starts_at ?? new Date().toISOString(),
    ends_at: b.endsAt !== undefined ? b.endsAt : cur?.ends_at ?? null,
    is_active: b.enabled ?? cur?.is_active ?? true,
  };
  const errors: Record<string, string> = {};
  if (s.name.length < 2) errors.name = 'Name is required.';
  if (!s.type) errors.type = 'Type is required.';
  if (!s.value) errors.value = 'Value must be greater than zero.';
  if (s.type === 'PERCENTAGE' && s.value > 100) errors.value = 'A percentage discount cannot exceed 100.';
  if (s.ends_at && new Date(s.ends_at) <= new Date(s.starts_at)) errors.endsAt = 'End date must be after the start date.';
  if (s.applies_to === 'ALL') s.target_ids = [];
  else if (!s.target_ids.length) errors.targetIds = `Select at least one ${s.applies_to.toLowerCase().replace(/s$/, '')}.`;
  if (Object.keys(errors).length) throw badRequest('Discount validation failed.', errors);
  if (s.applies_to !== 'ALL') s.target_ids = await assertTargetsExist(TARGET_TABLE[s.applies_to], s.target_ids, 'targetIds');
  return s;
}

const listQuery = adminListQuery(['created_at', 'name', 'starts_at', 'ends_at', 'value']).extend({
  status: lowerEnum([...PROMOTION_STATUSES]).optional(),
  appliesTo: upperEnum([...SCOPES]).optional(),
});

/** /api/v1/admin/discounts */
export const discountsRouter = Router();

discountsRouter.get(
  '/',
  requirePermission('discounts:view'),
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const f = q<z.infer<typeof listQuery>>(req);
    const where = ['true'];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replaceAll('?', `$${params.length}`));
    };
    if (f.search) add('d.name ilike ?', `%${f.search}%`);
    if (f.status) add(`(${promotionStatusSql('d')}) = ?`, f.status);
    if (f.appliesTo) add('d.applies_to = ?::public.discount_scope', f.appliesTo);
    const n = params.length;
    const rows = await query<Row & { total: number }>(
      `${SELECT.replace('select d.*,', 'select d.*, count(*) over ()::int as total,')} where ${where.join(' and ')}
        order by d.${f.sort ?? 'created_at'} ${f.order}, d.id limit $${n + 1} offset $${n + 2}`,
      [...params, f.limit, offsetOf(f.page, f.limit)],
    );
    const total = rows[0]?.total ?? (await queryOne<{ n: number }>(`select count(*)::int as n from public.discounts d where ${where.join(' and ')}`, params))!.n;
    return paginated(res, rows.map(toDiscount), pageMeta(f.page, f.limit, total));
  }),
);

discountsRouter.get('/:id', requirePermission('discounts:view'), validate({ params: uuidParam() }), asyncHandler(async (req, res) => ok(res, await load(req.params.id))));

const COLS = `name = $2, type = $3::public.discount_type, value = $4, applies_to = $5::public.discount_scope, target_ids = $6::uuid[], starts_at = $7, ends_at = $8, is_active = $9`;
const vals = (s: State) => [s.name, s.type, s.value, s.applies_to, s.target_ids, s.starts_at, s.ends_at, s.is_active];

discountsRouter.post(
  '/',
  requirePermission('discounts:create'),
  validate({ body }),
  asyncHandler(async (req, res) => {
    const b = req.body as Body;
    if (!b.name || !b.type || !b.value) throw badRequest('name, type and value are required.');
    const s = await build(b);
    const id = await withTransaction(async (tx) => {
      const r = await queryOne<{ id: string }>(
        `insert into public.discounts (name, type, value, applies_to, target_ids, starts_at, ends_at, is_active)
         values ($1, $2::public.discount_type, $3, $4::public.discount_scope, $5::uuid[], $6, $7, $8) returning id`,
        vals(s),
        tx,
      );
      await audit(req, { action: 'Discount created', entityType: 'discount', entityId: r!.id, metadata: { name: s.name, type: s.type, value: s.value, appliesTo: s.applies_to } }, tx);
      return r!.id;
    });
    return created(res, await load(id), 'Discount created.');
  }),
);

async function update(req: Request, id: string, b: Body) {
  const cur = await queryOne<State & { starts_at: Date; ends_at: Date | null }>(`select * from public.discounts where id = $1`, [id]);
  if (!cur) throw notFound('Discount');
  const s = await build(b, { ...cur, starts_at: iso(cur.starts_at)!, ends_at: iso(cur.ends_at) });
  const toggle = Object.keys(b).length === 1 && b.enabled !== undefined;
  await withTransaction(async (tx) => {
    await query(`update public.discounts set ${COLS} where id = $1`, [id, ...vals(s)], tx);
    await audit(req, { action: toggle ? (s.is_active ? 'Discount enabled' : 'Discount disabled') : 'Discount updated', entityType: 'discount', entityId: id, metadata: { name: s.name, fields: Object.keys(b) } }, tx);
  });
  return load(id);
}

for (const method of ['patch', 'put'] as const) {
  discountsRouter[method](
    '/:id',
    requirePermission('discounts:edit'),
    validate({ params: uuidParam(), body }),
    asyncHandler(async (req, res) => ok(res, await update(req, req.params.id, req.body), 'Discount updated.')),
  );
}

discountsRouter.delete(
  '/:id',
  requirePermission('discounts:delete'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    await withTransaction(async (tx) => {
      const r = await queryOne<{ name: string }>(`delete from public.discounts where id = $1 returning name`, [req.params.id], tx);
      if (!r) throw notFound('Discount');
      await audit(req, { action: 'Discount deleted', entityType: 'discount', entityId: req.params.id, metadata: { name: r.name } }, tx);
    });
    return noContent(res, 'Discount deleted.');
  }),
);
