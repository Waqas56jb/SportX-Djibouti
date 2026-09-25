/**
 * Shared SQL building blocks for the public catalogue.
 *
 * Every storefront read goes through the `catalog` CTE: published, non-deleted products joined with
 * brand + category, the best active automatic promotion (same rules as pricing.bestPromotion, evaluated
 * in SQL so filters/sorts on the effective price never load products into Node) and live stock totals.
 */

/** Positional parameter collector: `p.add(value)` returns `$n`. Values are always bound, never interpolated. */
export class SqlParams {
  readonly values: unknown[] = [];
  add(value: unknown, cast?: string): string {
    this.values.push(value);
    return `$${this.values.length}${cast ? `::${cast}` : ''}`;
  }
}

/** Automatic discounts + flash sales active right now (mirrors pricing.activePromotions). */
export const PROMOS_CTE = `promos as (
  select type, value, applies_to, target_ids from public.discounts
   where is_active and starts_at <= now() and (ends_at is null or ends_at > now())
  union all
  select 'PERCENTAGE'::public.discount_type, discount_percent::bigint, 'PRODUCTS'::public.discount_scope, product_ids from public.flash_sales
   where is_active and starts_at <= now() and ends_at > now()
)`;

/** Published catalogue with effective price, sale flag and stock totals. Alias rows as `x` when selecting. */
export const CATALOG_CTE = `${PROMOS_CTE},
cat0 as (
  select p.id, p.slug, p.name, p.sku, p.department, p.sport, p.gender, p.product_type, p.price, p.compare_at_price,
         p.rating, p.review_count, p.popularity, p.units_sold, p.is_new, p.is_featured, p.badge, p.tags,
         p.short_description, p.created_at, p.published_at, p.brand_id, p.category_id, p.search_vector,
         b.name as brand_name, b.slug as brand_slug, c.slug as category_slug, c.name as category_name, c.parent_id as parent_category_id,
         coalesce(d.amount, 0)::bigint as promo_discount,
         coalesce(s.available, 0)::int as available,
         coalesce(s.threshold, 0)::int as low_threshold
    from public.products p
    join public.brands b on b.id = p.brand_id
    join public.categories c on c.id = p.category_id
    left join lateral (
      select max(least(p.price, case when pr.type = 'PERCENTAGE' then round(p.price * pr.value / 100.0) else pr.value end)) as amount
        from promos pr
       where pr.applies_to = 'ALL'
          or (pr.applies_to = 'PRODUCTS' and p.id = any(pr.target_ids))
          or (pr.applies_to = 'BRANDS' and p.brand_id = any(pr.target_ids))
          or (pr.applies_to = 'CATEGORIES' and (p.category_id = any(pr.target_ids) or c.parent_id = any(pr.target_ids)))
    ) d on true
    left join lateral (
      select sum(greatest(i.stock_quantity - i.reserved_quantity, 0)) as available, max(i.low_stock_threshold) as threshold
        from public.product_variants v join public.inventory i on i.variant_id = v.id
       where v.product_id = p.id and v.is_active and v.deleted_at is null
    ) s on true
   where p.status = 'PUBLISHED' and p.deleted_at is null
),
catalog as (
  select cat0.*, (cat0.price - cat0.promo_discount) as eff_price,
         (cat0.promo_discount > 0 or coalesce(cat0.compare_at_price, 0) > cat0.price - cat0.promo_discount) as is_sale
    from cat0
)`;

/** Columns + per-row lateral lookups for the product summary (used for a small, already-paged set `x`). */
export const SUMMARY_COLUMNS = `x.id, x.slug, x.name, x.sku, x.department, x.sport, x.gender, x.price, x.compare_at_price, x.eff_price,
  x.promo_discount, x.is_sale, x.rating, x.review_count, x.popularity, x.units_sold, x.is_new, x.is_featured, x.badge,
  x.short_description, x.created_at, x.brand_name, x.brand_slug, x.category_slug, x.category_name, x.available, x.low_threshold,
  (select pi.url from public.product_images pi where pi.product_id = x.id order by (pi.role = 'MAIN') desc, pi.position limit 1) as image,
  (select pi.url from public.product_images pi where pi.product_id = x.id and pi.role <> 'MAIN'
     order by (pi.role = 'HOVER') desc, pi.position limit 1) as hover_image,
  (select coalesce(json_agg(json_build_object('name', c.color, 'hex', c.color_hex) order by c.pos), '[]'::json)
     from (select distinct on (lower(v.color)) v.color, v.color_hex, v.position as pos from public.product_variants v
            where v.product_id = x.id and v.is_active and v.deleted_at is null order by lower(v.color), v.position) c) as colors,
  (select coalesce(array_agg(distinct v.size), '{}') from public.product_variants v
     where v.product_id = x.id and v.is_active and v.deleted_at is null) as sizes`;

/** Recursive category match (slug or id), including every descendant. `ref` must be a text[] parameter. */
export const categoryTreeSql = (ref: string) => `(with recursive t as (
    select id from public.categories where slug = any(${ref}) or id::text = any(${ref})
    union
    select c.id from public.categories c join t on c.parent_id = t.id
  ) select id from t)`;

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

const normaliseTerm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ');

/**
 * Full-text match (search_vector) OR every term found in name / brand / category / sport / department /
 * tags / gender / SKU (incl. variant SKUs). Simple plural stripping ("boots" → "boot").
 */
export function searchCondition(q: string, p: SqlParams): string | null {
  const raw = q.trim().slice(0, 120);
  if (!raw) return null;
  const terms = normaliseTerm(raw).split(/\s+/).filter(Boolean).slice(0, 8);
  const hay = `lower(concat_ws(' ', x.name, x.brand_name, x.category_name, x.category_slug, x.sport, x.department, x.sku,
    x.product_type, x.gender::text, array_to_string(x.tags, ' ')))`;
  const termConds = terms.map((t) => {
    const stem = t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t;
    const ref = p.add(`%${escapeLike(stem)}%`);
    return `(${hay} like ${ref} or exists (select 1 from public.product_variants sv
      where sv.product_id = x.id and sv.deleted_at is null and lower(sv.sku) like ${ref}))`;
  });
  const qRef = p.add(raw);
  const fts = `x.search_vector @@ plainto_tsquery('simple', ${qRef})`;
  return termConds.length ? `(${fts} or (${termConds.join(' and ')}))` : fts;
}

export const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
export function sizeRank(s: string): number {
  const i = SIZE_ORDER.indexOf(s.toUpperCase());
  if (i >= 0) return i;
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? 999 : 100 + n;
}
export const sortSizes = (sizes: string[]) => [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b));

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export const stockStatusOf = (available: number, threshold: number): StockStatus =>
  available <= 0 ? 'OUT_OF_STOCK' : available <= threshold ? 'LOW_STOCK' : 'IN_STOCK';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);
