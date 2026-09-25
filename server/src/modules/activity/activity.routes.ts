import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../config/database.js';
import { asyncHandler } from '../../utils/http.js';
import { ok, paginated } from '../../utils/apiResponse.js';
import { adminListQuery, dateBounds, offsetOf, pageMeta } from '../../utils/pagination.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, query as q } from '../../middleware/validation.middleware.js';
import { iso, upperEnum } from '../reports/zod-helpers.js';

/** Admin UI deep links per audited entity type. */
const LINKS: Record<string, (id: string) => string> = {
  order: (id) => `/orders/${id}`,
  customer: (id) => `/customers/${id}`,
  product: (id) => `/products/${id}`,
  inventory: () => '/inventory/movements',
  coupon: () => '/discounts/coupons',
  discount: () => '/discounts/automatic',
  flash_sale: () => '/discounts/flash-sales',
  campaign: () => '/marketing/campaigns',
  staff: () => '/settings/admin-users',
  role: () => '/settings/roles',
  settings: () => '/settings/store',
  shipping_zone: () => '/settings/shipping',
  shipping_method: () => '/settings/shipping',
  ticket: (id) => `/support/${id}`,
};

const listQuery = adminListQuery(['created_at', 'action']).extend({
  admin: z.string().uuid().optional(),
  adminId: z.string().uuid().optional(),
  module: z.string().trim().max(40).optional(),
  entityType: z.string().trim().max(40).optional(),
  entityId: z.string().trim().max(80).optional(),
  action: z.string().trim().max(120).optional(),
  status: upperEnum(['SUCCESS', 'FAILED']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** /api/v1/admin/activity-logs (also /activity) */
export const activityRouter = Router();

activityRouter.get(
  '/',
  requirePermission('settings:view'),
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const f = q<z.infer<typeof listQuery>>(req);
    const where = ['true'];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replaceAll('?', `$${params.length}`));
    };
    const admin = f.admin ?? f.adminId;
    const module = f.module ?? f.entityType;
    if (admin) add('l.admin_id = ?', admin);
    if (module) add('lower(l.entity_type) = lower(?)', module);
    if (f.entityId) add('l.entity_id = ?', f.entityId);
    if (f.action) add('l.action ilike ?', f.action);
    if (f.status) add('l.status = ?', f.status);
    if (f.search)
      add(
        `(l.action ilike ? or l.entity_type ilike ? or coalesce(l.entity_id, '') ilike ? or l.metadata::text ilike ?
          or coalesce(u.first_name || ' ' || u.last_name, '') ilike ? or coalesce(u.email, '') ilike ?)`,
        `%${f.search}%`,
      );
    const { from, to } = dateBounds(f.date_from ?? f.from, f.date_to ?? f.to);
    if (from) add('l.created_at >= ?::timestamptz', from);
    if (to) add('l.created_at <= ?::timestamptz', to);
    const n = params.length;
    const rows = await query<{
      id: string;
      admin_id: string | null;
      admin_name: string | null;
      admin_email: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      metadata: Record<string, unknown>;
      status: string;
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
      total: number;
    }>(
      `select l.*, nullif(trim(u.first_name || ' ' || u.last_name), '') as admin_name, u.email as admin_email, count(*) over ()::int as total
         from public.admin_activity_logs l left join public.users u on u.id = l.admin_id
        where ${where.join(' and ')}
        order by l.${f.sort ?? 'created_at'} ${f.order}, l.id limit $${n + 1} offset $${n + 2}`,
      [...params, f.limit, offsetOf(f.page, f.limit)],
    );
    const total =
      rows[0]?.total ??
      (await queryOne<{ n: number }>(`select count(*)::int as n from public.admin_activity_logs l left join public.users u on u.id = l.admin_id where ${where.join(' and ')}`, params))!.n;
    const data = rows.map((r) => {
      const m = r.metadata ?? {};
      const record = [m.orderNumber, m.code, m.name, m.sku, m.email, m.slug].find((v) => typeof v === 'string' && v) as string | undefined;
      return {
        id: r.id,
        adminId: r.admin_id,
        adminName: r.admin_name ?? (r.admin_id ? 'Staff' : 'System'),
        adminEmail: r.admin_email,
        action: r.action,
        module: r.entity_type,
        entityType: r.entity_type,
        entityId: r.entity_id,
        record: record ?? r.entity_id ?? '',
        recordLink: r.entity_id && LINKS[r.entity_type] ? LINKS[r.entity_type](r.entity_id) : null,
        metadata: m,
        status: r.status,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        createdAt: iso(r.created_at)!,
      };
    });
    return paginated(res, data, pageMeta(f.page, f.limit, total));
  }),
);

/** Values for the filter dropdowns. */
activityRouter.get(
  '/filters',
  requirePermission('settings:view'),
  asyncHandler(async (_req, res) => {
    const modules = await query<{ v: string }>(`select distinct entity_type as v from public.admin_activity_logs order by 1`);
    const actions = await query<{ v: string }>(`select distinct action as v from public.admin_activity_logs order by 1 limit 200`);
    const admins = await query<{ id: string; name: string }>(
      `select distinct u.id, trim(u.first_name || ' ' || u.last_name) as name from public.admin_activity_logs l join public.users u on u.id = l.admin_id order by 2`,
    );
    return ok(res, { modules: modules.map((m) => m.v), actions: actions.map((a) => a.v), admins });
  }),
);
