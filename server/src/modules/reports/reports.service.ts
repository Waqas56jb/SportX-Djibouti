import { z } from 'zod';
import { query, queryOne } from '../../config/database.js';
import { CUSTOMER_STATS_CTE, isCustomer } from '../admin-customers/customers.sql.js';
import { LIVE_VARIANT_JOIN, LOW_STOCK_SQL, OUT_OF_STOCK_SQL } from '../dashboard/dashboard.service.js';
import { bucketsCte, NOT_CANCELLED, PAID, pctChange, reportQuery, resolveRange, type ReportQuery } from './range.js';

// ─── Sales ──────────────────────────────────────────────────────────────────

interface SalesAgg {
  orders: number;
  revenue: number;
  gross: number;
  product_discounts: number;
  coupon_discounts: number;
  refunds: number;
  shipping: number;
  tax: number;
}

/** Aggregate over paid orders (see range.ts for the revenue definition). `where` bounds are bound params. */
const SALES_AGG = `count(*)::int as orders,
  coalesce(sum(o.grand_total), 0) as revenue,
  coalesce(sum(o.subtotal), 0) as gross,
  coalesce(sum(o.product_discount_total), 0) as product_discounts,
  coalesce(sum(o.coupon_discount), 0) as coupon_discounts,
  coalesce(sum(o.refunded_total), 0) as refunds,
  coalesce(sum(o.shipping_total), 0) as shipping,
  coalesce(sum(o.tax_total), 0) as tax`;

function salesTotals(a: SalesAgg) {
  const discounts = a.product_discounts + a.coupon_discounts;
  return {
    /** What customers paid (grand totals of paid orders). */
    revenue: a.revenue,
    orders: a.orders,
    aov: a.orders ? Math.round(a.revenue / a.orders) : 0,
    /** Merchandise before discounts. */
    grossSales: a.gross,
    discounts,
    productDiscounts: a.product_discounts,
    couponDiscounts: a.coupon_discounts,
    refunds: a.refunds,
    shipping: a.shipping,
    tax: a.tax,
    /** revenue - refunds (= dashboard revenue). */
    netSales: a.revenue - a.refunds,
  };
}

export async function salesReport(q: ReportQuery) {
  const r = await resolveRange(q, q.groupBy);
  const rows = await query<SalesAgg & { date: Date; label: string }>(
    `with ${bucketsCte(r.bucket)}
     select b.start_at as date, b.label, a.*
       from buckets b
       left join lateral (select ${SALES_AGG} from public.orders o where ${PAID} and o.placed_at >= b.start_at and o.placed_at < b.end_at) a on true
      order by b.start_at`,
    [r.timezone, r.from, r.to],
  );
  const totalsSql = `select ${SALES_AGG} from public.orders o where ${PAID} and o.placed_at >= $1 and o.placed_at < $2`;
  const cur = await queryOne<SalesAgg>(totalsSql, [r.from, r.to]);
  const prev = await queryOne<SalesAgg>(totalsSql, [r.previousFrom, r.previousTo]);
  const totals = salesTotals(cur!);
  const previous = salesTotals(prev!);
  const change = Object.fromEntries(Object.keys(totals).map((k) => [k, pctChange(totals[k as keyof typeof totals], previous[k as keyof typeof previous])]));
  return {
    range: { preset: r.preset, label: r.label, bucket: r.bucket, from: r.from, to: r.to, previousFrom: r.previousFrom, previousTo: r.previousTo },
    totals,
    previous,
    change,
    series: rows.map((x) => ({ date: new Date(x.date).toISOString(), label: x.label, ...salesTotals(x) })),
  };
}

// ─── Products ───────────────────────────────────────────────────────────────

export const productReportQuery = reportQuery.extend({
  category: z.string().uuid().optional(),
  brand: z.string().uuid().optional(),
  sport: z.string().trim().max(40).optional(),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  sort: z.enum(['revenue', 'units', 'views', 'conversion', 'stock', 'name', 'trend']).default('revenue'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ProductReportQuery = z.infer<typeof productReportQuery>;

const PRODUCT_SORT: Record<ProductReportQuery['sort'], string> = {
  revenue: 'revenue',
  units: 'units',
  views: 'view_count',
  conversion: 'conversion',
  stock: 'stock',
  name: 'lower(name)',
  trend: 'units - prev_units',
};

interface ProductReportRow {
  id: string;
  name: string;
  sku: string;
  slug: string;
  status: string;
  product_type: string;
  sport: string;
  category: string;
  brand: string;
  view_count: number;
  units: number;
  revenue: number;
  prev_units: number;
  stock: number;
  conversion: number | null;
  image: string | null;
  total: number;
}

function mapProductReport(r: ProductReportRow) {
  return {
    productId: r.id,
    name: r.name,
    sku: r.sku,
    slug: r.slug,
    status: r.status,
    productType: r.product_type,
    sport: r.sport,
    category: r.category,
    brand: r.brand,
    image: r.image,
    unitsSold: r.units,
    revenue: r.revenue,
    /** Lifetime product page views (products.view_count). */
    views: r.view_count,
    /** Estimated conversion = units sold in the period / lifetime views, in percent, capped at 100 (views are not tracked per period yet). */
    conversion: r.conversion === null ? null : Math.round(Number(r.conversion) * 100) / 100,
    stock: r.stock,
    previousUnits: r.prev_units,
    trend: pctChange(r.units, r.prev_units),
  };
}

export async function productReport(q: ProductReportQuery, opts: { all?: boolean } = {}) {
  const r = await resolveRange(q, q.groupBy);
  const params: unknown[] = [r.from, r.to, r.previousFrom, r.previousTo];
  const where = ['p.deleted_at is null'];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  let catCte = '';
  if (q.category) {
    params.push(q.category);
    catCte = `cat as (select id from public.categories where id = $${params.length} union all select c.id from public.categories c join cat on c.parent_id = cat.id),`;
    where.push(`p.category_id in (select id from cat)`);
  }
  if (q.brand) add('p.brand_id = ?', q.brand);
  if (q.sport) add('p.sport = ?', q.sport);
  if (q.status) add('p.status = ?::public.product_status', q.status);
  if (q.search) add(`(p.name ilike ? or p.sku ilike ?)`, `%${q.search}%`);

  const base = `with recursive ${catCte}
    sold as (select i.product_id, sum(i.quantity)::int as units, sum(i.line_total) as revenue
               from public.order_items i join public.orders o on o.id = i.order_id
              where ${NOT_CANCELLED} and o.placed_at >= $1 and o.placed_at < $2 group by i.product_id),
    prev as (select i.product_id, sum(i.quantity)::int as units
               from public.order_items i join public.orders o on o.id = i.order_id
              where ${NOT_CANCELLED} and o.placed_at >= $3 and o.placed_at < $4 group by i.product_id),
    rows as (
      select p.id, p.name, p.sku, p.slug, p.status, p.product_type, p.sport, p.view_count, c.name as category, b.name as brand,
             coalesce(s.units, 0) as units, coalesce(s.revenue, 0) as revenue, coalesce(pv.units, 0) as prev_units,
             coalesce((select sum(inv.stock_quantity) from public.product_variants v join public.inventory inv on inv.variant_id = v.id
                        where v.product_id = p.id and v.deleted_at is null), 0)::int as stock,
             case when p.view_count > 0 then least(100, coalesce(s.units, 0)::numeric * 100 / p.view_count) end as conversion,
             (select im.url from public.product_images im where im.product_id = p.id order by (im.role = 'MAIN') desc, im.position limit 1) as image
        from public.products p
        join public.categories c on c.id = p.category_id
        join public.brands b on b.id = p.brand_id
        left join sold s on s.product_id = p.id
        left join prev pv on pv.product_id = p.id
       where ${where.join(' and ')})`;

  const n = params.length;
  const limit = opts.all ? 5000 : q.limit;
  const offset = opts.all ? 0 : (q.page - 1) * q.limit;
  const items = await query<ProductReportRow>(
    `${base} select rows.*, count(*) over ()::int as total from rows
      order by ${PRODUCT_SORT[q.sort]} ${q.order} nulls last, id limit $${n + 1} offset $${n + 2}`,
    [...params, limit, offset],
  );
  const summary = await queryOne<{ products: number; units: number; revenue: number; views: number }>(
    `${base} select count(*)::int as products, coalesce(sum(units), 0)::int as units, coalesce(sum(revenue), 0) as revenue, coalesce(sum(view_count), 0)::int as views from rows`,
    params,
  );
  const best = await query<ProductReportRow>(`${base} select rows.*, 0 as total from rows where units > 0 order by revenue desc, units desc, id limit 5`, params);
  const worst = await query<ProductReportRow>(
    `${base} select rows.*, 0 as total from rows where status = 'PUBLISHED' order by units asc, revenue asc, view_count desc, id limit 5`,
    params,
  );
  return {
    range: { preset: r.preset, label: r.label, from: r.from, to: r.to, previousFrom: r.previousFrom, previousTo: r.previousTo },
    totals: {
      products: summary!.products,
      unitsSold: summary!.units,
      revenue: summary!.revenue,
      views: summary!.views,
      conversion: summary!.views ? Math.min(100, Math.round((summary!.units / summary!.views) * 10_000) / 100) : null,
    },
    best: best.map(mapProductReport),
    worst: worst.map(mapProductReport),
    items: items.map(mapProductReport),
    total: items[0]?.total ?? summary!.products,
  };
}

// ─── Customers ──────────────────────────────────────────────────────────────

export async function customerReport(q: ReportQuery) {
  const r = await resolveRange(q, q.groupBy);
  const series = await query<{ date: Date; label: string; new_customers: number; returning: number; buyers: number; total: number }>(
    `with ${bucketsCte(r.bucket)}
     select b.start_at as date, b.label,
            (select count(*)::int from public.users u where u.deleted_at is null and ${isCustomer('u')} and u.created_at >= b.start_at and u.created_at < b.end_at) as new_customers,
            (select count(distinct o.user_id)::int from public.orders o
              where ${NOT_CANCELLED} and o.placed_at >= b.start_at and o.placed_at < b.end_at
                and exists (select 1 from public.orders o2 where o2.user_id = o.user_id and o2.status <> 'CANCELLED' and o2.deleted_at is null and o2.placed_at < o.placed_at)) as returning,
            (select count(distinct o.user_id)::int from public.orders o where ${NOT_CANCELLED} and o.placed_at >= b.start_at and o.placed_at < b.end_at) as buyers,
            (select count(*)::int from public.users u where u.deleted_at is null and ${isCustomer('u')} and u.created_at < b.end_at) as total
       from buckets b order by b.start_at`,
    [r.timezone, r.from, r.to],
  );

  const t = await queryOne<{ total_customers: number; new_customers: number; buyers: number; returning: number; orders: number; paying: number; revenue: number }>(
    `select (select count(*)::int from public.users u where u.deleted_at is null and ${isCustomer('u')}) as total_customers,
            (select count(*)::int from public.users u where u.deleted_at is null and ${isCustomer('u')} and u.created_at >= $1 and u.created_at < $2) as new_customers,
            (select count(distinct o.user_id)::int from public.orders o where ${NOT_CANCELLED} and o.placed_at >= $1 and o.placed_at < $2) as buyers,
            (select count(distinct o.user_id)::int from public.orders o where ${NOT_CANCELLED} and o.placed_at >= $1 and o.placed_at < $2
                and exists (select 1 from public.orders o2 where o2.user_id = o.user_id and o2.status <> 'CANCELLED' and o2.deleted_at is null and o2.placed_at < o.placed_at)) as returning,
            (select count(*)::int from public.orders o where ${NOT_CANCELLED} and o.placed_at >= $1 and o.placed_at < $2) as orders,
            (select count(distinct o.user_id)::int from public.orders o where ${PAID} and o.placed_at >= $1 and o.placed_at < $2) as paying,
            (select coalesce(sum(o.grand_total - o.refunded_total), 0) from public.orders o where ${PAID} and o.placed_at >= $1 and o.placed_at < $2) as revenue`,
    [r.from, r.to],
  );

  const top = await query<{ id: string; name: string; email: string; orders: number; spent: number }>(
    `select u.id, u.first_name || ' ' || u.last_name as name, u.email, count(*)::int as orders, sum(o.grand_total - o.refunded_total) as spent
       from public.orders o join public.users u on u.id = o.user_id
      where ${PAID} and o.placed_at >= $1 and o.placed_at < $2
      group by u.id order by spent desc, orders desc limit 8`,
    [r.from, r.to],
  );

  const byCity = await query<{ name: string; value: number }>(
    `select coalesce(nullif(trim(a.city), ''), 'Unknown') as name, count(*)::int as value
       from public.users u left join public.addresses a on a.user_id = u.id and a.is_default
      where u.deleted_at is null and ${isCustomer('u')}
      group by 1 order by value desc, name`,
  );

  const g = await queryOne<Record<string, number>>(
    `with ${CUSTOMER_STATS_CTE}
     select count(*) filter (where g_new)::int as new, count(*) filter (where g_returning)::int as returning,
            count(*) filter (where g_high_value)::int as high_value, count(*) filter (where g_inactive)::int as inactive
       from customer_stats`,
  );

  const x = t!;
  return {
    range: { preset: r.preset, label: r.label, bucket: r.bucket, from: r.from, to: r.to },
    totals: {
      totalCustomers: x.total_customers,
      newCustomers: x.new_customers,
      returningCustomers: x.returning,
      buyers: x.buyers,
      /** Share of this period's buyers who had ordered before. */
      repeatRate: x.buyers ? Math.round((x.returning / x.buyers) * 1000) / 10 : 0,
      /** Net paid revenue per paying customer in the period. */
      averageSpend: x.paying ? Math.round(x.revenue / x.paying) : 0,
      ordersPerCustomer: x.buyers ? Math.round((x.orders / x.buyers) * 100) / 100 : 0,
    },
    growth: series.map((s) => ({ date: new Date(s.date).toISOString(), label: s.label, newCustomers: s.new_customers, returningCustomers: s.returning, buyers: s.buyers, total: s.total })),
    topCustomers: top,
    byCity,
    byGroup: [
      { id: 'new', name: 'New', value: g!.new },
      { id: 'returning', name: 'Returning', value: g!.returning },
      { id: 'high_value', name: 'High value', value: g!.high_value },
      { id: 'inactive', name: 'Inactive', value: g!.inactive },
    ],
  };
}

// ─── Inventory ──────────────────────────────────────────────────────────────

export async function inventoryReport(q: ReportQuery) {
  // Movement defaults to the last 3 months, weekly.
  const r = await resolveRange({ ...q, range: q.range ?? '3m' }, q.groupBy ?? 'week');
  const age = `extract(day from now() - coalesce(i.last_restocked_at, v.created_at))`;
  const retail = `coalesce(v.price, p.price)`;

  const totals = await queryOne<Record<string, number>>(
    `select count(distinct p.id)::int as products, count(*)::int as variants,
            coalesce(sum(i.stock_quantity), 0)::int as units, coalesce(sum(i.reserved_quantity), 0)::int as reserved,
            count(*) filter (where ${LOW_STOCK_SQL})::int as low, count(*) filter (where ${OUT_OF_STOCK_SQL})::int as out,
            coalesce(sum(i.stock_quantity::bigint * coalesce(p.cost_price, 0)), 0) as stock_value,
            coalesce(sum(i.stock_quantity::bigint * ${retail}), 0) as retail_value,
            count(*) filter (where p.cost_price is null and i.stock_quantity > 0)::int as missing_cost
       from ${LIVE_VARIANT_JOIN}`,
  );

  const aging = await query<{ bucket: string; variants: number; units: number; value: number }>(
    `select k.bucket, count(x.*)::int as variants, coalesce(sum(x.units), 0)::int as units, coalesce(sum(x.value), 0) as value
       from (values (1, '0-30 days', 0, 30), (2, '31-60 days', 31, 60), (3, '61-90 days', 61, 90), (4, '90+ days', 91, 1000000)) as k(pos, bucket, lo, hi)
       left join (select ${age} as days, i.stock_quantity as units, i.stock_quantity::bigint * coalesce(p.cost_price, 0) as value
                    from ${LIVE_VARIANT_JOIN} where i.stock_quantity > 0) x on x.days between k.lo and k.hi
      group by k.pos, k.bucket order by k.pos`,
  );

  const movement = await query<{ date: Date; label: string; inbound: number; outbound: number }>(
    `with ${bucketsCte(r.bucket)}
     select b.start_at as date, b.label,
            coalesce((select sum(m.change) from public.inventory_movements m where m.change > 0 and m.created_at >= b.start_at and m.created_at < b.end_at), 0)::int as inbound,
            coalesce((select -sum(m.change) from public.inventory_movements m where m.change < 0 and m.created_at >= b.start_at and m.created_at < b.end_at), 0)::int as outbound
       from buckets b order by b.start_at`,
    [r.timezone, r.from, r.to],
  );

  const topStocked = await query<{ product_id: string; name: string; units: number; value: number; retail_value: number }>(
    `select p.id as product_id, p.name, sum(i.stock_quantity)::int as units,
            coalesce(sum(i.stock_quantity::bigint * coalesce(p.cost_price, 0)), 0) as value,
            coalesce(sum(i.stock_quantity::bigint * ${retail}), 0) as retail_value
       from ${LIVE_VARIANT_JOIN} group by p.id, p.name order by units desc, p.name limit 8`,
  );

  const x = totals!;
  return {
    range: { preset: r.preset, label: r.label, bucket: r.bucket, from: r.from, to: r.to },
    totals: {
      products: x.products,
      variants: x.variants,
      units: x.units,
      reserved: x.reserved,
      lowStock: x.low,
      outOfStock: x.out,
      /** Σ stock × cost_price (products without a cost price count as 0 — see variantsMissingCost). */
      stockValue: x.stock_value,
      inventoryValue: x.stock_value,
      /** Σ stock × selling price (variant override or product price). */
      retailValue: x.retail_value,
      variantsMissingCost: x.missing_cost,
    },
    aging,
    movement: movement.map((m) => ({ date: new Date(m.date).toISOString(), label: m.label, inbound: m.inbound, outbound: m.outbound })),
    topStocked: topStocked.map((t) => ({ productId: t.product_id, name: t.name, units: t.units, value: t.value, retailValue: t.retail_value })),
    byStatus: [
      { id: 'IN_STOCK', name: 'In stock', value: x.variants - x.low - x.out },
      { id: 'LOW_STOCK', name: 'Low stock', value: x.low },
      { id: 'OUT_OF_STOCK', name: 'Out of stock', value: x.out },
    ],
  };
}

/** Per-product stock valuation (CSV export of the inventory report). */
export async function inventoryValuation() {
  return query<{ product_id: string; name: string; sku: string; variants: number; units: number; reserved: number; value: number; retail_value: number }>(
    `select p.id as product_id, p.name, p.sku, count(*)::int as variants, sum(i.stock_quantity)::int as units, sum(i.reserved_quantity)::int as reserved,
            coalesce(sum(i.stock_quantity::bigint * coalesce(p.cost_price, 0)), 0) as value,
            coalesce(sum(i.stock_quantity::bigint * coalesce(v.price, p.price)), 0) as retail_value
       from ${LIVE_VARIANT_JOIN} group by p.id, p.name, p.sku order by p.name`,
  );
}
