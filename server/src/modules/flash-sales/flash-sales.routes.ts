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
import { isoDate, iso, lowerEnum } from '../reports/zod-helpers.js';
import { assertTargetsExist } from '../discounts/targets.js';

const STATUSES = ['upcoming', 'active', 'ended', 'disabled'] as const;
const STATUS_SQL = `case when not f.is_active then 'disabled' when f.starts_at > now() then 'upcoming' when f.ends_at <= now() then 'ended' else 'active' end`;

interface Row {
  id: string;
  name: string;
  discount_percent: number;
  product_ids: string[];
  starts_at: Date;
  ends_at: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  status: string;
  units_sold: number;
  revenue: number;
  orders: number;
  products: { id: string; name: string; price: number; image: string | null }[] | null;
}

/** Units sold & revenue = order_items for the sale's products in non-cancelled orders placed inside the window. */
const SELECT = `select f.*, ${STATUS_SQL} as status, coalesce(s.units, 0)::int as units_sold, coalesce(s.revenue, 0) as revenue, coalesce(s.orders, 0)::int as orders,
    (select coalesce(json_agg(json_build_object('id', p.id, 'name', p.name, 'price', p.price,
        'image', (select im.url from public.product_images im where im.product_id = p.id order by (im.role = 'MAIN') desc, im.position limit 1))), '[]'::json)
       from public.products p where p.id = any(f.product_ids)) as products
  from public.flash_sales f
  left join lateral (
    select sum(i.quantity) as units, sum(i.line_total) as revenue, count(distinct o.id) as orders
      from public.order_items i join public.orders o on o.id = i.order_id
     where i.product_id = any(f.product_ids) and o.status <> 'CANCELLED' and o.deleted_at is null
       and o.placed_at >= f.starts_at and o.placed_at < f.ends_at) s on true`;

const toFlashSale = (r: Row) => ({
  id: r.id,
  name: r.name,
  discountPercent: r.discount_percent,
  productIds: r.product_ids,
  products: r.products ?? [],
  startsAt: iso(r.starts_at)!,
  endsAt: iso(r.ends_at)!,
  enabled: r.is_active,
  status: r.status,
  unitsSold: r.units_sold,
  revenue: r.revenue,
  orders: r.orders,
  createdAt: iso(r.created_at)!,
  updatedAt: iso(r.updated_at)!,
});

async function load(id: string) {
  const r = await queryOne<Row>(`${SELECT} where f.id = $1`, [id]);
  if (!r) throw notFound('Flash sale');
  return toFlashSale(r);
}

const body = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  discountPercent: z.number().int().min(1).max(90).optional(),
  productIds: z.array(z.string().uuid()).min(1).max(500).optional(),
  startsAt: isoDate().optional(),
  endsAt: isoDate().optional(),
  enabled: z.boolean().optional(),
});
type Body = z.infer<typeof body>;

interface State {
  name: string;
  discount_percent: number;
  product_ids: string[];
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

async function build(b: Body, cur?: State): Promise<State> {
  const s: State = {
    name: b.name ?? cur?.name ?? '',
    discount_percent: (b.discountPercent ?? cur?.discount_percent) as number,
    product_ids: b.productIds ?? cur?.product_ids ?? [],
    starts_at: (b.startsAt ?? cur?.starts_at) as string,
    ends_at: (b.endsAt ?? cur?.ends_at) as string,
    is_active: b.enabled ?? cur?.is_active ?? true,
  };
  const errors: Record<string, string> = {};
  if (s.name.length < 2) errors.name = 'Name is required.';
  if (!s.discount_percent) errors.discountPercent = 'Discount (1–90%) is required.';
  if (!s.product_ids.length) errors.productIds = 'Select at least one product.';
  if (!s.starts_at) errors.startsAt = 'Start date is required.';
  if (!s.ends_at) errors.endsAt = 'End date is required.';
  else if (s.starts_at && new Date(s.ends_at) <= new Date(s.starts_at)) errors.endsAt = 'End must be after start.';
  if (Object.keys(errors).length) throw badRequest('Flash sale validation failed.', errors);
  s.product_ids = await assertTargetsExist('products', s.product_ids, 'productIds');
  return s;
}

const listQuery = adminListQuery(['starts_at', 'ends_at', 'created_at', 'name', 'discount_percent']).extend({ status: lowerEnum([...STATUSES]).optional() });

/** /api/v1/admin/flash-sales */
export const flashSalesRouter = Router();

flashSalesRouter.get(
  '/',
  requirePermission('discounts:view'),
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const f = q<z.infer<typeof listQuery>>(req);
    const where = ['true'];
    const params: unknown[] = [];
    if (f.search) {
      params.push(`%${f.search}%`);
      where.push(`f.name ilike $${params.length}`);
    }
    if (f.status) {
      params.push(f.status);
      where.push(`(${STATUS_SQL}) = $${params.length}`);
    }
    const n = params.length;
    const rows = await query<Row & { total: number }>(
      `${SELECT.replace('select f.*,', 'select f.*, count(*) over ()::int as total,')} where ${where.join(' and ')}
        order by f.${f.sort ?? 'starts_at'} ${f.order}, f.id limit $${n + 1} offset $${n + 2}`,
      [...params, f.limit, offsetOf(f.page, f.limit)],
    );
    const total = rows[0]?.total ?? (await queryOne<{ n: number }>(`select count(*)::int as n from public.flash_sales f where ${where.join(' and ')}`, params))!.n;
    return paginated(res, rows.map(toFlashSale), pageMeta(f.page, f.limit, total));
  }),
);

flashSalesRouter.get('/:id', requirePermission('discounts:view'), validate({ params: uuidParam() }), asyncHandler(async (req, res) => ok(res, await load(req.params.id))));

const vals = (s: State) => [s.name, s.discount_percent, s.product_ids, s.starts_at, s.ends_at, s.is_active];

flashSalesRouter.post(
  '/',
  requirePermission('discounts:create'),
  validate({ body }),
  asyncHandler(async (req, res) => {
    const s = await build(req.body);
    const id = await withTransaction(async (tx) => {
      const r = await queryOne<{ id: string }>(
        `insert into public.flash_sales (name, discount_percent, product_ids, starts_at, ends_at, is_active) values ($1, $2, $3::uuid[], $4, $5, $6) returning id`,
        vals(s),
        tx,
      );
      await audit(req, { action: 'Flash sale created', entityType: 'flash_sale', entityId: r!.id, metadata: { name: s.name, discountPercent: s.discount_percent, products: s.product_ids.length } }, tx);
      return r!.id;
    });
    return created(res, await load(id), 'Flash sale created.');
  }),
);

async function update(req: Request, id: string, b: Body) {
  const cur = await queryOne<State & { starts_at: Date; ends_at: Date }>(`select * from public.flash_sales where id = $1`, [id]);
  if (!cur) throw notFound('Flash sale');
  const s = await build(b, { ...cur, starts_at: iso(cur.starts_at)!, ends_at: iso(cur.ends_at)! });
  const toggle = Object.keys(b).length === 1 && b.enabled !== undefined;
  await withTransaction(async (tx) => {
    await query(
      `update public.flash_sales set name = $2, discount_percent = $3, product_ids = $4::uuid[], starts_at = $5, ends_at = $6, is_active = $7 where id = $1`,
      [id, ...vals(s)],
      tx,
    );
    await audit(req, { action: toggle ? (s.is_active ? 'Flash sale enabled' : 'Flash sale disabled') : 'Flash sale updated', entityType: 'flash_sale', entityId: id, metadata: { name: s.name, fields: Object.keys(b) } }, tx);
  });
  return load(id);
}

for (const method of ['patch', 'put'] as const) {
  flashSalesRouter[method](
    '/:id',
    requirePermission('discounts:edit'),
    validate({ params: uuidParam(), body }),
    asyncHandler(async (req, res) => ok(res, await update(req, req.params.id, req.body), 'Flash sale updated.')),
  );
}

flashSalesRouter.delete(
  '/:id',
  requirePermission('discounts:delete'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    await withTransaction(async (tx) => {
      const r = await queryOne<{ name: string }>(`delete from public.flash_sales where id = $1 returning name`, [req.params.id], tx);
      if (!r) throw notFound('Flash sale');
      await audit(req, { action: 'Flash sale deleted', entityType: 'flash_sale', entityId: req.params.id, metadata: { name: r.name } }, tx);
    });
    return noContent(res, 'Flash sale deleted.');
  }),
);
