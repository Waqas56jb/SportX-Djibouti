import { query, queryOne } from '../../config/database.js';
import { toOrderSummary, type OrderRow } from '../orders/orders.mapper.js';
import { isCustomer } from '../admin-customers/customers.sql.js';
import { bucketsCte, NOT_CANCELLED, PAID, pctChange, resolveRange, type RangeQuery, type ResolvedRange } from '../reports/range.js';

/**
 * Dashboard aggregates — all from live tables, one response.
 *
 * Revenue ("sales") = paid orders (payment_status PAID / PARTIALLY_REFUNDED / REFUNDED) minus what was
 * refunded on them (grand_total - refunded_total), attributed to the order's placed_at.
 * Units / top products / categories use order_items of non-cancelled orders placed in the period.
 * Queue counters (pending, refund requests, open tickets, pending reviews, stock alerts) are current
 * totals, not period-scoped; completed/cancelled counts are orders placed in the period.
 */
const NET = `(o.grand_total - o.refunded_total)`;
const OPEN_TICKETS = `status in ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER')`;

/** Variant availability status — shared with inventory. available = stock - reserved. */
export const LOW_STOCK_SQL = `(i.stock_quantity - i.reserved_quantity) > 0 and (i.stock_quantity - i.reserved_quantity) <= i.low_stock_threshold`;
export const OUT_OF_STOCK_SQL = `(i.stock_quantity - i.reserved_quantity) <= 0`;
/** Sellable variants: variant + product not deleted, product not archived. */
export const LIVE_VARIANT_JOIN = `public.inventory i
  join public.product_variants v on v.id = i.variant_id and v.deleted_at is null
  join public.products p on p.id = v.product_id and p.deleted_at is null and p.status <> 'ARCHIVED'`;

async function sales(r: ResolvedRange) {
  const row = await queryOne<Record<string, number>>(
    `select coalesce(sum(${NET}), 0) as total,
            coalesce(sum(${NET}) filter (where o.placed_at >= date_trunc('day', now() at time zone $1) at time zone $1), 0) as today,
            coalesce(sum(${NET}) filter (where o.placed_at >= date_trunc('month', now() at time zone $1) at time zone $1), 0) as month,
            coalesce(sum(${NET}) filter (where o.placed_at >= $2 and o.placed_at < $3), 0) as period,
            coalesce(sum(${NET}) filter (where o.placed_at >= $4 and o.placed_at < $5), 0) as previous,
            count(*) filter (where o.placed_at >= $2 and o.placed_at < $3)::int as period_paid_orders
       from public.orders o where ${PAID}`,
    [r.timezone, r.from, r.to, r.previousFrom, r.previousTo],
  );
  const s = row!;
  return {
    totalSales: s.total,
    todaySales: s.today,
    monthlySales: s.month,
    periodRevenue: s.period,
    previousPeriodRevenue: s.previous,
    change: pctChange(s.period, s.previous),
    averageOrderValue: s.period_paid_orders ? Math.round(s.period / s.period_paid_orders) : 0,
  };
}

async function orders(r: ResolvedRange) {
  const o = await queryOne<Record<string, number>>(
    `select count(*)::int as total,
            count(*) filter (where placed_at >= $1 and placed_at < $2)::int as period,
            count(*) filter (where placed_at >= $3 and placed_at < $4)::int as previous,
            count(*) filter (where status in ('PENDING', 'PAYMENT_CONFIRMED', 'PROCESSING'))::int as pending,
            count(*) filter (where status = 'DELIVERED' and placed_at >= $1 and placed_at < $2)::int as completed,
            count(*) filter (where status = 'CANCELLED' and placed_at >= $1 and placed_at < $2)::int as cancelled,
            count(*) filter (where status = 'REFUND_REQUESTED')::int as refund_requests
       from public.orders where deleted_at is null`,
    [r.from, r.to, r.previousFrom, r.previousTo],
  );
  return {
    total: o!.total,
    periodOrders: o!.period,
    previous: o!.previous,
    change: pctChange(o!.period, o!.previous),
    pending: o!.pending,
    completed: o!.completed,
    cancelled: o!.cancelled,
    refundRequests: o!.refund_requests,
  };
}

async function customers(r: ResolvedRange) {
  const c = await queryOne<Record<string, number>>(
    `select count(*)::int as total,
            count(*) filter (where u.created_at >= $1 and u.created_at < $2)::int as period,
            count(*) filter (where u.created_at >= $3 and u.created_at < $4)::int as previous
       from public.users u where u.deleted_at is null and ${isCustomer('u')}`,
    [r.from, r.to, r.previousFrom, r.previousTo],
  );
  return { total: c!.total, newInPeriod: c!.period, previous: c!.previous, change: pctChange(c!.period, c!.previous) };
}

async function productsSold(r: ResolvedRange) {
  const u = await queryOne<{ period: number; previous: number }>(
    `select coalesce(sum(i.quantity) filter (where o.placed_at >= $1 and o.placed_at < $2), 0)::int as period,
            coalesce(sum(i.quantity) filter (where o.placed_at >= $3 and o.placed_at < $4), 0)::int as previous
       from public.order_items i join public.orders o on o.id = i.order_id
      where ${NOT_CANCELLED} and o.placed_at >= least($1::timestamptz, $3::timestamptz)`,
    [r.from, r.to, r.previousFrom, r.previousTo],
  );
  return { value: u!.period, previous: u!.previous, change: pctChange(u!.period, u!.previous) };
}

async function catalogue() {
  const p = await queryOne<{ total: number; published: number }>(
    `select count(*)::int as total, count(*) filter (where status = 'PUBLISHED')::int as published from public.products where deleted_at is null`,
  );
  const s = await queryOne<{ low: number; out: number }>(
    `select count(*) filter (where ${LOW_STOCK_SQL})::int as low, count(*) filter (where ${OUT_OF_STOCK_SQL})::int as out from ${LIVE_VARIANT_JOIN}`,
  );
  return { total: p!.total, published: p!.published, lowStockVariants: s!.low, outOfStockVariants: s!.out };
}

async function queues() {
  const q = await queryOne<{ tickets: number; reviews: number }>(
    `select (select count(*)::int from public.support_tickets where ${OPEN_TICKETS}) as tickets,
            (select count(*)::int from public.reviews where status = 'PENDING' and deleted_at is null) as reviews`,
  );
  return { supportOpen: q!.tickets, reviewsPending: q!.reviews };
}

async function recentOrders(limit = 8) {
  const rows = await query<OrderRow & { first_item_image: string | null }>(
    `select o.*, (select image_url from public.order_items i where i.order_id = o.id order by i.created_at limit 1) as first_item_image
       from public.orders o where o.deleted_at is null order by o.placed_at desc, o.id limit $1`,
    [limit],
  );
  return rows.map(toOrderSummary);
}

/** Best sellers by line revenue in [from, to). Shared with the product report. */
export async function topProducts(from: string, to: string, limit = 5) {
  const rows = await query<{
    product_id: string;
    units: number;
    revenue: number;
    snap_name: string;
    snap_image: string | null;
    name: string | null;
    slug: string | null;
    category: string | null;
    brand: string | null;
    product_type: string | null;
    image: string | null;
    stock: number;
  }>(
    `with sold as (
       select i.product_id, sum(i.quantity)::int as units, sum(i.line_total) as revenue,
              max(i.product_name) as snap_name, max(i.image_url) as snap_image
         from public.order_items i join public.orders o on o.id = i.order_id
        where ${NOT_CANCELLED} and o.placed_at >= $1 and o.placed_at < $2 and i.product_id is not null
        group by i.product_id
        order by revenue desc, units desc
        limit $3)
     select s.*, p.name, p.slug, c.name as category, b.name as brand, p.product_type,
            (select im.url from public.product_images im where im.product_id = p.id order by (im.role = 'MAIN') desc, im.position limit 1) as image,
            coalesce((select sum(inv.stock_quantity) from public.product_variants v join public.inventory inv on inv.variant_id = v.id
                       where v.product_id = s.product_id and v.deleted_at is null), 0)::int as stock
       from sold s
       left join public.products p on p.id = s.product_id
       left join public.categories c on c.id = p.category_id
       left join public.brands b on b.id = p.brand_id
      order by s.revenue desc, s.units desc`,
    [from, to, limit],
  );
  return rows.map((r) => ({
    productId: r.product_id,
    name: r.name ?? r.snap_name,
    slug: r.slug,
    image: r.image ?? r.snap_image,
    category: r.category,
    brand: r.brand,
    productType: r.product_type,
    unitsSold: r.units,
    revenue: r.revenue,
    stock: r.stock,
  }));
}

async function salesChart(r: ResolvedRange) {
  const rows = await query<{ date: Date; label: string; revenue: number; orders: number; units: number; new_customers: number }>(
    `with ${bucketsCte(r.bucket)}
     select b.start_at as date, b.label,
            coalesce((select sum(${NET}) from public.orders o where ${PAID} and o.placed_at >= b.start_at and o.placed_at < b.end_at), 0) as revenue,
            (select count(*)::int from public.orders o where ${PAID} and o.placed_at >= b.start_at and o.placed_at < b.end_at) as orders,
            coalesce((select sum(i.quantity) from public.order_items i join public.orders o on o.id = i.order_id
                       where ${NOT_CANCELLED} and o.placed_at >= b.start_at and o.placed_at < b.end_at), 0)::int as units,
            (select count(*)::int from public.users u where u.deleted_at is null and ${isCustomer('u')} and u.created_at >= b.start_at and u.created_at < b.end_at) as new_customers
       from buckets b order by b.start_at`,
    [r.timezone, r.from, r.to],
  );
  return rows.map((x) => ({
    date: new Date(x.date).toISOString(),
    label: x.label,
    revenue: x.revenue,
    orders: x.orders,
    aov: x.orders ? Math.round(x.revenue / x.orders) : 0,
    units: x.units,
    newCustomers: x.new_customers,
  }));
}

/** Revenue share per top-level category (sub-categories roll up to their root). */
export async function salesByCategory(from: string, to: string) {
  const rows = await query<{ category_id: string; category: string; revenue: number; units: number }>(
    `with recursive tree as (
       select id, id as root_id, name as root_name from public.categories where parent_id is null
       union all
       select c.id, t.root_id, t.root_name from public.categories c join tree t on c.parent_id = t.id)
     select t.root_id as category_id, t.root_name as category, sum(i.line_total) as revenue, sum(i.quantity)::int as units
       from public.order_items i
       join public.orders o on o.id = i.order_id
       join public.products p on p.id = i.product_id
       join tree t on t.id = p.category_id
      where ${NOT_CANCELLED} and o.placed_at >= $1 and o.placed_at < $2
      group by t.root_id, t.root_name
      order by revenue desc`,
    [from, to],
  );
  const total = rows.reduce((s, x) => s + x.revenue, 0);
  return rows.map((x) => ({ categoryId: x.category_id, category: x.category, revenue: x.revenue, units: x.units, share: total ? Math.round((x.revenue / total) * 1000) / 10 : 0 }));
}

export async function navCounts() {
  const r = await queryOne<Record<string, number>>(
    `select (select count(*)::int from public.orders where deleted_at is null and status in ('PENDING', 'PAYMENT_CONFIRMED', 'PROCESSING')) as orders,
            (select count(*)::int from ${LIVE_VARIANT_JOIN} where ${LOW_STOCK_SQL}) as low_stock,
            (select count(*)::int from ${LIVE_VARIANT_JOIN} where ${OUT_OF_STOCK_SQL}) as out_of_stock,
            (select count(*)::int from public.support_tickets where ${OPEN_TICKETS}) as support,
            (select count(*)::int from public.reviews where status = 'PENDING' and deleted_at is null) as reviews,
            (select count(*)::int from public.orders where deleted_at is null and status = 'REFUND_REQUESTED') as refunds`,
  );
  return { orders: r!.orders, lowStock: r!.low_stock, outOfStock: r!.out_of_stock, support: r!.support, reviews: r!.reviews, refunds: r!.refunds };
}

export async function getDashboard(q: Partial<RangeQuery>) {
  const r = await resolveRange(q);
  // Independent read-only queries run concurrently (outside a transaction the pool simply queues them,
  // so this is also safe with a 1-connection pool). Matters with a remote database: ~10 round trips → 1.
  const [s_, o, c, units, products, qs, recent, top, chart, byCategory] = await Promise.all([
    sales(r),
    orders(r),
    customers(r),
    productsSold(r),
    catalogue(),
    queues(),
    recentOrders(8),
    topProducts(r.from, r.to, 5),
    salesChart(r),
    salesByCategory(r.from, r.to),
  ]);
  const s = s_;

  return {
    range: { preset: r.preset, label: r.label, bucket: r.bucket, timezone: r.timezone, from: r.from, to: r.to, previousFrom: r.previousFrom, previousTo: r.previousTo },
    sales: s,
    orders: o,
    customers: c,
    productsSold: units,
    products,
    supportOpen: qs.supportOpen,
    reviewsPending: qs.reviewsPending,
    recentOrders: recent,
    topProducts: top,
    salesChart: chart,
    salesByCategory: byCategory,
    /** KPI cards in the admin's { value, previous, change, trend } shape. */
    kpis: {
      revenue: { value: s.periodRevenue, previous: s.previousPeriodRevenue, change: s.change, trend: chart.map((x) => x.revenue) },
      orders: { value: o.periodOrders, previous: o.previous, change: o.change, trend: chart.map((x) => x.orders) },
      customers: { value: c.newInPeriod, previous: c.previous, change: c.change, trend: chart.map((x) => x.newCustomers) },
      productsSold: { value: units.value, previous: units.previous, change: units.change, trend: chart.map((x) => x.units) },
    },
  };
}
