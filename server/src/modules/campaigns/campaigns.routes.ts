import { Router, type Request } from 'express';
import { z } from 'zod';
import { query, queryOne, withTransaction } from '../../config/database.js';
import { asyncHandler } from '../../utils/http.js';
import { created, noContent, ok, paginated } from '../../utils/apiResponse.js';
import { AppError, badRequest, notFound } from '../../utils/errors.js';
import { adminListQuery, dateBounds, offsetOf, pageMeta } from '../../utils/pagination.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, query as q, uuidParam } from '../../middleware/validation.middleware.js';
import { imageUpload } from '../../middleware/upload.middleware.js';
import { audit } from '../../services/audit.service.js';
import { storageService } from '../../services/storage/storage.service.js';
import { isoDate, iso, lowerEnum, upperEnum } from '../reports/zod-helpers.js';
import { assertTargetsExist } from '../discounts/targets.js';

const TYPES = ['seasonal', 'new_arrivals', 'football', 'basketball', 'training', 'clearance', 'limited_release'] as const;
const STATUSES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'ENDED'] as const;
type Status = (typeof STATUSES)[number];

interface Row {
  id: string;
  name: string;
  type: string;
  description: string;
  banner_url: string | null;
  banner_path: string | null;
  product_ids: string[];
  category_ids: string[];
  starts_at: Date;
  ends_at: Date;
  status: Status;
  impressions: number;
  clicks: number;
  created_at: Date;
  updated_at: Date;
  revenue: number;
  units: number;
}

/** Attributed revenue: line totals of the campaign's products (or products in its categories) in non-cancelled orders placed during the window. */
const SELECT = `select c.*, coalesce(s.revenue, 0) as revenue, coalesce(s.units, 0)::int as units
  from public.campaigns c
  left join lateral (
    select sum(i.line_total) as revenue, sum(i.quantity) as units
      from public.order_items i
      join public.orders o on o.id = i.order_id
      left join public.products p on p.id = i.product_id
      left join public.categories cat on cat.id = p.category_id
     where o.status <> 'CANCELLED' and o.deleted_at is null and o.placed_at >= c.starts_at and o.placed_at < c.ends_at
       and (i.product_id = any(c.product_ids) or p.category_id = any(c.category_ids) or cat.parent_id = any(c.category_ids))) s on true`;

const toCampaign = (r: Row) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  description: r.description,
  bannerUrl: r.banner_url,
  productIds: r.product_ids,
  categoryIds: r.category_ids,
  startsAt: iso(r.starts_at)!,
  endsAt: iso(r.ends_at)!,
  status: r.status,
  impressions: r.impressions,
  clicks: r.clicks,
  ctr: r.impressions ? Math.round((r.clicks / r.impressions) * 10_000) / 100 : 0,
  revenue: r.revenue,
  unitsSold: r.units,
  createdAt: iso(r.created_at)!,
  updatedAt: iso(r.updated_at)!,
});

async function load(id: string) {
  const r = await queryOne<Row>(`${SELECT} where c.id = $1`, [id]);
  if (!r) throw notFound('Campaign');
  return toCampaign(r);
}

const body = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  type: lowerEnum([...TYPES]).optional(),
  description: z.string().trim().max(2000).optional(),
  productIds: z.array(z.string().uuid()).max(500).optional(),
  categoryIds: z.array(z.string().uuid()).max(100).optional(),
  startsAt: isoDate().optional(),
  endsAt: isoDate().optional(),
  status: upperEnum([...STATUSES]).optional(),
});
type Body = z.infer<typeof body>;

interface State {
  name: string;
  type: string;
  description: string;
  product_ids: string[];
  category_ids: string[];
  starts_at: string;
  ends_at: string;
  status: Status;
}

function checkStatus(status: Status, endsAt: string) {
  if ((status === 'ACTIVE' || status === 'SCHEDULED') && new Date(endsAt).getTime() <= Date.now())
    throw new AppError('CONFLICT', 'This campaign has already ended; change its end date before activating it.');
}

async function build(b: Body, cur?: State): Promise<State> {
  const s: State = {
    name: b.name ?? cur?.name ?? '',
    type: (b.type ?? cur?.type) as string,
    description: b.description ?? cur?.description ?? '',
    product_ids: b.productIds ?? cur?.product_ids ?? [],
    category_ids: b.categoryIds ?? cur?.category_ids ?? [],
    starts_at: (b.startsAt ?? cur?.starts_at) as string,
    ends_at: (b.endsAt ?? cur?.ends_at) as string,
    status: b.status ?? cur?.status ?? 'DRAFT',
  };
  const errors: Record<string, string> = {};
  if (s.name.length < 2) errors.name = 'Name is required.';
  if (!s.type) errors.type = 'Type is required.';
  if (!s.starts_at) errors.startsAt = 'Start date is required.';
  if (!s.ends_at) errors.endsAt = 'End date is required.';
  else if (s.starts_at && new Date(s.ends_at) <= new Date(s.starts_at)) errors.endsAt = 'End date must be after start date.';
  if (Object.keys(errors).length) throw badRequest('Campaign validation failed.', errors);
  s.product_ids = await assertTargetsExist('products', s.product_ids, 'productIds');
  s.category_ids = await assertTargetsExist('categories', s.category_ids, 'categoryIds');
  return s;
}

const listQuery = adminListQuery(['starts_at', 'ends_at', 'created_at', 'name', 'status']).extend({
  status: upperEnum([...STATUSES]).optional(),
  type: lowerEnum([...TYPES]).optional(),
});

/** /api/v1/admin/campaigns */
export const campaignsRouter = Router();

campaignsRouter.get(
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
    if (f.search) add('(c.name ilike ? or c.description ilike ?)', `%${f.search}%`);
    if (f.status) add('c.status = ?::public.campaign_status', f.status);
    if (f.type) add('c.type = ?', f.type);
    const { from, to } = dateBounds(f.date_from, f.date_to);
    if (from) add('c.ends_at >= ?', from);
    if (to) add('c.starts_at <= ?', to);
    const n = params.length;
    const rows = await query<Row & { total: number }>(
      `${SELECT.replace('select c.*,', 'select c.*, count(*) over ()::int as total,')} where ${where.join(' and ')}
        order by c.${f.sort ?? 'starts_at'} ${f.order}, c.id limit $${n + 1} offset $${n + 2}`,
      [...params, f.limit, offsetOf(f.page, f.limit)],
    );
    const total = rows[0]?.total ?? (await queryOne<{ n: number }>(`select count(*)::int as n from public.campaigns c where ${where.join(' and ')}`, params))!.n;
    return paginated(res, rows.map(toCampaign), pageMeta(f.page, f.limit, total));
  }),
);

campaignsRouter.get('/:id', requirePermission('discounts:view'), validate({ params: uuidParam() }), asyncHandler(async (req, res) => ok(res, await load(req.params.id))));

const vals = (s: State) => [s.name, s.type, s.description, s.product_ids, s.category_ids, s.starts_at, s.ends_at, s.status];

campaignsRouter.post(
  '/',
  requirePermission('discounts:create'),
  validate({ body }),
  asyncHandler(async (req, res) => {
    const s = await build(req.body);
    checkStatus(s.status, s.ends_at);
    const id = await withTransaction(async (tx) => {
      const r = await queryOne<{ id: string }>(
        `insert into public.campaigns (name, type, description, product_ids, category_ids, starts_at, ends_at, status)
         values ($1, $2, $3, $4::uuid[], $5::uuid[], $6, $7, $8::public.campaign_status) returning id`,
        vals(s),
        tx,
      );
      await audit(req, { action: 'Campaign created', entityType: 'campaign', entityId: r!.id, metadata: { name: s.name, type: s.type, status: s.status } }, tx);
      return r!.id;
    });
    return created(res, await load(id), 'Campaign created.');
  }),
);

async function update(req: Request, id: string, b: Body, action = 'Campaign updated') {
  const cur = await queryOne<State & { starts_at: Date; ends_at: Date }>(`select * from public.campaigns where id = $1`, [id]);
  if (!cur) throw notFound('Campaign');
  const s = await build(b, { ...cur, starts_at: iso(cur.starts_at)!, ends_at: iso(cur.ends_at)! });
  if (s.status !== cur.status) checkStatus(s.status, s.ends_at);
  await withTransaction(async (tx) => {
    await query(
      `update public.campaigns set name = $2, type = $3, description = $4, product_ids = $5::uuid[], category_ids = $6::uuid[],
              starts_at = $7, ends_at = $8, status = $9::public.campaign_status where id = $1`,
      [id, ...vals(s)],
      tx,
    );
    await audit(req, { action, entityType: 'campaign', entityId: id, metadata: { name: s.name, fields: Object.keys(b), ...(s.status !== cur.status ? { from: cur.status, to: s.status } : {}) } }, tx);
  });
  return load(id);
}

for (const method of ['patch', 'put'] as const) {
  campaignsRouter[method](
    '/:id',
    requirePermission('discounts:edit'),
    validate({ params: uuidParam(), body }),
    asyncHandler(async (req, res) => ok(res, await update(req, req.params.id, req.body), 'Campaign updated.')),
  );
}

const STATUS_ACTION: Record<Status, string> = {
  ACTIVE: 'Campaign activated',
  PAUSED: 'Campaign paused',
  ARCHIVED: 'Campaign archived',
  SCHEDULED: 'Campaign scheduled',
  DRAFT: 'Campaign moved to draft',
  ENDED: 'Campaign ended',
};

campaignsRouter.patch(
  '/:id/status',
  requirePermission('discounts:edit'),
  validate({ params: uuidParam(), body: z.object({ status: upperEnum([...STATUSES]) }) }),
  asyncHandler(async (req, res) => ok(res, await update(req, req.params.id, { status: req.body.status }, STATUS_ACTION[req.body.status as Status]), 'Campaign status updated.')),
);

campaignsRouter.post(
  '/:id/banner',
  requirePermission('discounts:edit'),
  validate({ params: uuidParam() }),
  imageUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Attach an image in the "file" field.');
    const cur = await queryOne<{ banner_path: string | null; name: string }>(`select banner_path, name from public.campaigns where id = $1`, [req.params.id]);
    if (!cur) throw notFound('Campaign');
    const stored = await storageService.putImage('campaigns', req.params.id, req.file);
    try {
      await withTransaction(async (tx) => {
        await query(`update public.campaigns set banner_url = $2, banner_path = $3 where id = $1`, [req.params.id, stored.url, stored.path], tx);
        await audit(req, { action: 'Campaign banner updated', entityType: 'campaign', entityId: req.params.id, metadata: { name: cur.name } }, tx);
      });
    } catch (err) {
      await storageService.remove(stored.path);
      throw err;
    }
    await storageService.remove(cur.banner_path);
    return ok(res, await load(req.params.id), 'Banner uploaded.');
  }),
);

campaignsRouter.delete(
  '/:id/banner',
  requirePermission('discounts:edit'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    const cur = await queryOne<{ banner_path: string | null; name: string }>(`select banner_path, name from public.campaigns where id = $1`, [req.params.id]);
    if (!cur) throw notFound('Campaign');
    await withTransaction(async (tx) => {
      await query(`update public.campaigns set banner_url = null, banner_path = null where id = $1`, [req.params.id], tx);
      await audit(req, { action: 'Campaign banner removed', entityType: 'campaign', entityId: req.params.id, metadata: { name: cur.name } }, tx);
    });
    await storageService.remove(cur.banner_path);
    return ok(res, await load(req.params.id), 'Banner removed.');
  }),
);

campaignsRouter.delete(
  '/:id',
  requirePermission('discounts:delete'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    const path = await withTransaction(async (tx) => {
      const r = await queryOne<{ name: string; banner_path: string | null }>(`delete from public.campaigns where id = $1 returning name, banner_path`, [req.params.id], tx);
      if (!r) throw notFound('Campaign');
      await audit(req, { action: 'Campaign deleted', entityType: 'campaign', entityId: req.params.id, metadata: { name: r.name } }, tx);
      return r.banner_path;
    });
    await storageService.remove(path);
    return noContent(res, 'Campaign deleted.');
  }),
);
