/**
 * Shared SQL for "customers" = non-deleted users holding the CUSTOMER role.
 *
 * Group rules (computed on read, never stored):
 *   new        — joined within the last 30 days
 *   returning  — 2+ non-cancelled orders
 *   high_value — lifetime paid spend (grand_total - refunded_total of paid orders) ≥ DJF 80,000
 *   inactive   — no order in the last 60 days (accounts with no order at all count from their join date)
 */
export const HIGH_VALUE_THRESHOLD = 80_000;
export const CUSTOMER_GROUPS = ['new', 'returning', 'high_value', 'inactive'] as const;
export type CustomerGroup = (typeof CUSTOMER_GROUPS)[number];

export const isCustomer = (alias = 'u') =>
  `exists (select 1 from public.user_roles cur join public.roles cr on cr.id = cur.role_id where cur.user_id = ${alias}.id and cr.slug = 'CUSTOMER')`;

/** CTE body: one row per customer with lifetime order stats and group flags. */
export const CUSTOMER_STATS_CTE = `customer_stats as (
  select u.id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.status, u.marketing_opt_in, u.notes,
         u.created_at, u.last_login_at,
         coalesce(s.orders_count, 0) as orders_count,
         coalesce(s.total_spent, 0) as total_spent,
         coalesce(s.paid_orders, 0) as paid_orders,
         s.last_order_at,
         (select a.city from public.addresses a where a.user_id = u.id order by a.is_default desc, a.created_at limit 1) as city,
         (u.created_at >= now() - interval '30 days') as g_new,
         (coalesce(s.orders_count, 0) >= 2) as g_returning,
         (coalesce(s.total_spent, 0) >= ${HIGH_VALUE_THRESHOLD}) as g_high_value,
         (coalesce(s.last_order_at, u.created_at) < now() - interval '60 days') as g_inactive
    from public.users u
    left join lateral (
      select count(*) filter (where o.status <> 'CANCELLED')::int as orders_count,
             coalesce(sum(o.grand_total - o.refunded_total) filter (where o.payment_status in ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')), 0) as total_spent,
             count(*) filter (where o.payment_status in ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'))::int as paid_orders,
             max(o.placed_at) as last_order_at
        from public.orders o
       where o.user_id = u.id and o.deleted_at is null
    ) s on true
   where u.deleted_at is null and ${isCustomer('u')}
)`;

export interface CustomerStatsRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  marketing_opt_in: boolean;
  notes: string | null;
  created_at: Date;
  last_login_at: Date | null;
  orders_count: number;
  total_spent: number;
  paid_orders: number;
  last_order_at: Date | null;
  city: string | null;
  g_new: boolean;
  g_returning: boolean;
  g_high_value: boolean;
  g_inactive: boolean;
}

export function groupsOf(r: Pick<CustomerStatsRow, 'g_new' | 'g_returning' | 'g_high_value' | 'g_inactive'>): CustomerGroup[] {
  const g: CustomerGroup[] = [];
  if (r.g_new) g.push('new');
  if (r.g_returning) g.push('returning');
  if (r.g_high_value) g.push('high_value');
  if (r.g_inactive) g.push('inactive');
  return g;
}

const iso = (v: Date | string | null | undefined) => (v ? new Date(v).toISOString() : null);

export function toCustomerRow(r: CustomerStatsRow) {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    name: `${r.first_name} ${r.last_name}`.trim(),
    email: r.email,
    phone: r.phone ?? '',
    avatarUrl: r.avatar_url,
    status: r.status,
    ordersCount: r.orders_count,
    totalSpent: r.total_spent,
    averageOrder: r.paid_orders ? Math.round(r.total_spent / r.paid_orders) : 0,
    lastOrderAt: iso(r.last_order_at),
    lastLoginAt: iso(r.last_login_at),
    city: r.city,
    joinedAt: iso(r.created_at)!,
    groups: groupsOf(r),
  };
}
