import { z } from 'zod';
import type { Request } from 'express';
import { query, queryOne, withTransaction } from '../../config/database.js';
import { AppError, notFound } from '../../utils/errors.js';
import { adminListQuery, dateBounds, offsetOf } from '../../utils/pagination.js';
import { audit } from '../../services/audit.service.js';
import { invalidateAuthContext } from '../auth/auth.context.js';
import { revokeAllSessions } from '../auth/tokens.js';
import { toOrderSummary, type OrderRow } from '../orders/orders.mapper.js';
import { iso, lowerEnum, upperEnum } from '../reports/zod-helpers.js';
import { CUSTOMER_GROUPS, CUSTOMER_STATS_CTE, groupsOf, HIGH_VALUE_THRESHOLD, isCustomer, toCustomerRow, type CustomerStatsRow } from './customers.sql.js';

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const;

export const customerListQuery = adminListQuery(['joined_at', 'name', 'orders_count', 'total_spent', 'last_order_at']).extend({
  status: upperEnum([...USER_STATUSES]).optional(),
  group: lowerEnum(['all', ...CUSTOMER_GROUPS]).optional(),
  city: z.string().trim().max(80).optional(),
});
export type CustomerListQuery = z.infer<typeof customerListQuery>;

const SORT: Record<string, string> = {
  joined_at: 'created_at',
  name: 'lower(first_name || last_name)',
  orders_count: 'orders_count',
  total_spent: 'total_spent',
  last_order_at: 'last_order_at',
};

export async function listCustomers(f: CustomerListQuery) {
  const where = ['true'];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (f.search) {
    // Phone numbers are matched with and without spaces ("+253 77…" vs "25377…").
    const digits = f.search.replace(/[^0-9]/g, '');
    params.push(`%${f.search}%`, digits.length >= 3 ? `%${digits}%` : null);
    const a = params.length - 1;
    const d = params.length;
    where.push(`((first_name || ' ' || last_name) ilike $${a} or email ilike $${a} or coalesce(phone, '') ilike $${a}
          or ($${d}::text is not null and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') like $${d}::text))`);
  }
  if (f.status) add('status = ?::public.user_status', f.status);
  if (f.group && f.group !== 'all') where.push(`g_${f.group}`); // whitelisted by the zod enum
  if (f.city) add(`exists (select 1 from public.addresses a where a.user_id = cs.id and a.city ilike ?)`, f.city);
  const { from, to } = dateBounds(f.date_from, f.date_to);
  if (from) add('created_at >= ?', from);
  if (to) add('created_at <= ?', to);
  const n = params.length;
  const rows = await query<CustomerStatsRow & { total: number }>(
    `with ${CUSTOMER_STATS_CTE}
     select cs.*, count(*) over ()::int as total from customer_stats cs where ${where.join(' and ')}
      order by ${SORT[f.sort ?? 'joined_at']} ${f.order} nulls last, id limit $${n + 1} offset $${n + 2}`,
    [...params, f.limit, offsetOf(f.page, f.limit)],
  );
  let total = rows[0]?.total;
  if (total === undefined) {
    total = (await queryOne<{ n: number }>(`with ${CUSTOMER_STATS_CTE} select count(*)::int as n from customer_stats cs where ${where.join(' and ')}`, params))!.n;
  }
  return { rows: rows.map(toCustomerRow), total };
}

export async function groupSummary() {
  const r = await queryOne<Record<string, number>>(
    `with ${CUSTOMER_STATS_CTE}
     select count(*)::int as all_count, coalesce(sum(total_spent), 0) as all_revenue,
            count(*) filter (where g_new)::int as new_count, coalesce(sum(total_spent) filter (where g_new), 0) as new_revenue,
            count(*) filter (where g_returning)::int as returning_count, coalesce(sum(total_spent) filter (where g_returning), 0) as returning_revenue,
            count(*) filter (where g_high_value)::int as high_value_count, coalesce(sum(total_spent) filter (where g_high_value), 0) as high_value_revenue,
            count(*) filter (where g_inactive)::int as inactive_count, coalesce(sum(total_spent) filter (where g_inactive), 0) as inactive_revenue
       from customer_stats`,
  );
  const rules: Record<string, string> = {
    all: 'All accounts',
    new: 'Joined ≤ 30 days ago',
    returning: 'Orders ≥ 2',
    high_value: `Total spent ≥ DJF ${HIGH_VALUE_THRESHOLD.toLocaleString('en-US')}`,
    inactive: 'No order in 60 days',
  };
  return (['all', ...CUSTOMER_GROUPS] as const).map((id) => ({ id, count: r![`${id}_count`], revenue: r![`${id}_revenue`], rule: rules[id] }));
}

export async function requireCustomer(id: string) {
  const row = await queryOne<CustomerStatsRow>(`with ${CUSTOMER_STATS_CTE} select * from customer_stats where id = $1`, [id]);
  if (!row) throw notFound('Customer');
  return row;
}

export async function customerActivity(id: string, limit = 60) {
  const rows = await query<{ id: string; type: string; title: string; description: string | null; link: string | null; created_at: Date }>(
    `select * from (
       select 'join:' || u.id as id, 'account_created' as type, 'Account created' as title, null::text as description, null::text as link, u.created_at
         from public.users u where u.id = $1
       union all
       select 'order:' || o.id, 'order_placed', 'Placed order ' || o.order_number, o.items_count || ' item(s) · DJF ' || o.grand_total, '/orders/' || o.id, o.placed_at
         from public.orders o where o.user_id = $1 and o.deleted_at is null
       union all
       select 'status:' || h.id, 'order_status', 'Order ' || o.order_number || ' → ' || replace(lower(h.status::text), '_', ' '), h.note, '/orders/' || o.id, h.created_at
         from public.order_status_history h join public.orders o on o.id = h.order_id
        where o.user_id = $1 and o.deleted_at is null and h.status <> 'PENDING'
       union all
       select 'review:' || r.id, 'review_posted', 'Reviewed ' || p.name, r.rating || '★ — ' || r.title, '/reviews', r.created_at
         from public.reviews r join public.products p on p.id = r.product_id where r.user_id = $1 and r.deleted_at is null
       union all
       select 'ticket:' || t.id, 'ticket_opened', 'Opened ticket ' || t.ticket_number, t.subject, '/support/' || t.id, t.created_at
         from public.support_tickets t where t.user_id = $1
       union all
       select 'log:' || l.id, 'status_changed', l.action,
              coalesce('by ' || nullif(trim(a.first_name || ' ' || a.last_name), ''), 'by staff') || coalesce(' — ' || (l.metadata->>'reason'), ''),
              null, l.created_at
         from public.admin_activity_logs l left join public.users a on a.id = l.admin_id
        where l.entity_type = 'customer' and l.entity_id = $1::text
     ) ev order by created_at desc limit $2`,
    [id, limit],
  );
  return rows.map((r) => ({ id: r.id, customerId: id, type: r.type, title: r.title, description: r.description, link: r.link, createdAt: iso(r.created_at)! }));
}

export async function customerDetail(id: string) {
  const c = await requireCustomer(id);
  const addresses = await query<Record<string, unknown>>(`select * from public.addresses where user_id = $1 order by is_default desc, created_at`, [id]);
  const wishlist = await query<{ product_id: string; name: string; slug: string; price: number; status: string; image: string | null; created_at: Date }>(
    `select wi.product_id, p.name, p.slug, p.price, p.status, wi.created_at,
            (select im.url from public.product_images im where im.product_id = p.id order by (im.role = 'MAIN') desc, im.position limit 1) as image
       from public.wishlists w join public.wishlist_items wi on wi.wishlist_id = w.id join public.products p on p.id = wi.product_id
      where w.user_id = $1 and p.deleted_at is null order by wi.created_at desc`,
    [id],
  );
  const recent = await query<OrderRow & { first_item_image: string | null }>(
    `select o.*, (select image_url from public.order_items i where i.order_id = o.id order by i.created_at limit 1) as first_item_image
       from public.orders o where o.user_id = $1 and o.deleted_at is null order by o.placed_at desc limit 5`,
    [id],
  );
  const reviews = await query<{ id: string; product_id: string; product_name: string; rating: number; title: string; status: string; created_at: Date }>(
    `select r.id, r.product_id, p.name as product_name, r.rating, r.title, r.status, r.created_at
       from public.reviews r join public.products p on p.id = r.product_id where r.user_id = $1 and r.deleted_at is null order by r.created_at desc limit 10`,
    [id],
  );
  const tickets = await query<{ id: string; ticket_number: string; subject: string; status: string; priority: string; category: string; created_at: Date; updated_at: Date }>(
    `select id, ticket_number, subject, status, priority, category, created_at, updated_at from public.support_tickets where user_id = $1 order by updated_at desc limit 10`,
    [id],
  );
  const stats = await queryOne<{ cancelled: number; refunded: number; reviews: number; tickets: number; open_tickets: number }>(
    `select (select count(*)::int from public.orders where user_id = $1 and status = 'CANCELLED' and deleted_at is null) as cancelled,
            (select coalesce(sum(refunded_total), 0) from public.orders where user_id = $1 and deleted_at is null) as refunded,
            (select count(*)::int from public.reviews where user_id = $1 and deleted_at is null) as reviews,
            (select count(*)::int from public.support_tickets where user_id = $1) as tickets,
            (select count(*)::int from public.support_tickets where user_id = $1 and status in ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER')) as open_tickets`,
    [id],
  );
  const base = toCustomerRow(c);
  return {
    ...base,
    marketingOptIn: c.marketing_opt_in,
    notes: c.notes,
    stats: {
      ordersCount: base.ordersCount,
      totalSpent: base.totalSpent,
      averageOrder: base.averageOrder,
      lastOrderAt: base.lastOrderAt,
      cancelledOrders: stats!.cancelled,
      refundedTotal: stats!.refunded,
      reviews: stats!.reviews,
      tickets: stats!.tickets,
      openTickets: stats!.open_tickets,
    },
    addresses: addresses.map((a) => ({
      id: a.id,
      label: a.label,
      firstName: a.first_name,
      lastName: a.last_name,
      fullName: `${a.first_name} ${a.last_name}`,
      phone: a.phone,
      line1: a.address_line_1,
      line2: a.address_line_2,
      district: a.district,
      city: a.city,
      country: a.country,
      postalCode: a.postal_code,
      isDefault: a.is_default,
    })),
    wishlist: {
      count: wishlist.length,
      items: wishlist.slice(0, 12).map((w) => ({ productId: w.product_id, name: w.name, slug: w.slug, price: w.price, status: w.status, image: w.image, addedAt: iso(w.created_at) })),
    },
    wishlistProductIds: wishlist.map((w) => w.product_id),
    recentOrders: recent.map(toOrderSummary),
    reviews: reviews.map((r) => ({ id: r.id, productId: r.product_id, productName: r.product_name, rating: r.rating, title: r.title, status: r.status, createdAt: iso(r.created_at) })),
    tickets: tickets.map((t) => ({ id: t.id, ticketNumber: t.ticket_number, subject: t.subject, status: t.status, priority: t.priority, category: t.category, createdAt: iso(t.created_at), updatedAt: iso(t.updated_at) })),
    activity: await customerActivity(id, 40),
  };
}

export const updateCustomerBody = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().max(30).regex(/^[+0-9 ()-]*$/, 'Invalid phone number.').nullable().optional(),
    marketingOptIn: z.boolean().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: 'Nothing to update.' });

export async function updateCustomer(req: Request, id: string, b: z.infer<typeof updateCustomerBody>) {
  await requireCustomer(id);
  await withTransaction(async (tx) => {
    await query(
      `update public.users set
          first_name = coalesce($2, first_name), last_name = coalesce($3, last_name),
          phone = case when $4 then nullif($5, '') else phone end,
          marketing_opt_in = coalesce($6, marketing_opt_in),
          notes = case when $7 then nullif($8, '') else notes end
        where id = $1`,
      [id, b.firstName ?? null, b.lastName ?? null, b.phone !== undefined, b.phone ?? null, b.marketingOptIn ?? null, b.notes !== undefined, b.notes ?? null],
      tx,
    );
    await audit(req, { action: 'Customer updated', entityType: 'customer', entityId: id, metadata: { fields: Object.keys(b).filter((k) => b[k as keyof typeof b] !== undefined) } }, tx);
  });
  invalidateAuthContext(id);
  return customerDetail(id);
}

export const statusBody = z.object({
  status: upperEnum([...USER_STATUSES]),
  reason: z.string().trim().max(500).optional().nullable(),
});

/** Blocking / deactivating revokes every refresh session; the next request with an old access token fails the status check. */
export async function setCustomerStatus(req: Request, id: string, b: z.infer<typeof statusBody>) {
  const c = await requireCustomer(id);
  const staff = await queryOne(`select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = $1 and r.is_staff`, [id]);
  if (staff) throw new AppError('FORBIDDEN', 'This account belongs to a staff member. Manage it from Admin users.');
  if (c.status !== b.status) {
    await withTransaction(async (tx) => {
      await query(`update public.users set status = $2::public.user_status where id = $1`, [id, b.status], tx);
      if (b.status !== 'ACTIVE') await revokeAllSessions(id, undefined, tx);
      await audit(req, { action: 'Customer status changed', entityType: 'customer', entityId: id, metadata: { email: c.email, from: c.status, to: b.status, reason: b.reason ?? null } }, tx);
    });
    invalidateAuthContext(id);
  }
  return customerDetail(id);
}

export const customerOrdersQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function customerOrders(id: string, page: number, limit: number) {
  const exists = await queryOne(`select 1 from public.users u where u.id = $1 and u.deleted_at is null and ${isCustomer('u')}`, [id]);
  if (!exists) throw notFound('Customer');
  const rows = await query<OrderRow & { first_item_image: string | null; total: number }>(
    `select o.*, count(*) over ()::int as total,
            (select image_url from public.order_items i where i.order_id = o.id order by i.created_at limit 1) as first_item_image
       from public.orders o where o.user_id = $1 and o.deleted_at is null order by o.placed_at desc, o.id limit $2 offset $3`,
    [id, limit, offsetOf(page, limit)],
  );
  const total = rows[0]?.total ?? (await queryOne<{ n: number }>(`select count(*)::int as n from public.orders where user_id = $1 and deleted_at is null`, [id]))!.n;
  return { rows: rows.map(toOrderSummary), total };
}

export { groupsOf };
