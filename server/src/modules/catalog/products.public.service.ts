import { pool, query, queryOne } from '../../config/database.js';
import { notFound } from '../../utils/errors.js';
import { offsetOf, pageMeta } from '../../utils/pagination.js';
import { activePromotions, bestPromotion } from '../pricing/pricing.service.js';
import { shippingService } from '../shipping/shipping.service.js';
import { getStoreSettings } from '../settings/settings.service.js';
import { logger } from '../../utils/logger.js';
import {
  CATALOG_CTE,
  SUMMARY_COLUMNS,
  SqlParams,
  categoryTreeSql,
  isUuid,
  searchCondition,
  sizeRank,
  sortSizes,
  stockStatusOf,
} from './catalog.sql.js';
import { compareAtOf, discountPercentOf, genderList, toImage, toProductSummary, type ImageRow, type ProductSummary, type SummaryRow } from './catalog.mapper.js';
import type { ProductListFilters, PublicSort } from './catalog.schema.js';

// ───────────────────────── Filters ─────────────────────────

/** Collection rules — identical to customer/src/data/collections.ts. Unknown keys fall back to a category slug. */
function collectionCondition(key: string, p: SqlParams): string | null {
  switch (key) {
    case 'shop':
      return null;
    case 'men':
      return `x.gender in ('MEN', 'UNISEX')`;
    case 'women':
      return `x.gender in ('WOMEN', 'UNISEX')`;
    case 'kids':
      return `x.gender = 'KIDS'`;
    case 'football':
    case 'basketball':
    case 'running':
    case 'training':
      return `x.sport = ${p.add(key)}`;
    case 'equipment':
      return `x.department in ('equipment', 'accessories')`;
    case 'new-arrivals':
      return `x.is_new`;
    case 'sale':
      return `x.is_sale`;
    case 'footwear':
    case 'apparel':
    case 'accessories':
      return `x.department = ${p.add(key)}`;
    default:
      // balls, bags, gym-equipment and any other category landing page: the category and its children.
      return `x.category_id in ${categoryTreeSql(p.add([key], 'text[]'))}`;
  }
}

/** Base set: collection + text search. Facets are computed on this set (like the customer mock). */
function baseConditions(f: Pick<ProductListFilters, 'collection' | 'q'>, p: SqlParams): string {
  const where: string[] = [];
  if (f.collection) {
    const c = collectionCondition(f.collection, p);
    if (c) where.push(c);
  }
  if (f.q) {
    const s = searchCondition(f.q, p);
    if (s) where.push(s);
  }
  return where.length ? where.join(' and ') : 'true';
}

/**
 * Refinements on top of the base set. Gender "men"/"women" include unisex products (same rule as the collections).
 * Size matches only variants with stock (mock behaviour); colour is case-insensitive at variant level.
 */
function filterConditions(f: ProductListFilters, p: SqlParams): string {
  const where: string[] = [];
  if (f.categories.length) where.push(`x.category_id in ${categoryTreeSql(p.add(f.categories, 'text[]'))}`);
  if (f.brands.length) {
    const ref = p.add(f.brands, 'text[]');
    where.push(`(x.brand_slug = any(${ref}) or lower(x.brand_name) = any(${ref}) or x.brand_id::text = any(${ref}))`);
  }
  if (f.genders.length) {
    const g = new Set(f.genders);
    if (g.has('MEN') || g.has('WOMEN')) g.add('UNISEX');
    where.push(`x.gender::text = any(${p.add([...g], 'text[]')})`);
  }
  if (f.sports.length) where.push(`x.sport = any(${p.add(f.sports, 'text[]')})`);
  if (f.sizes.length) {
    where.push(`exists (select 1 from public.product_variants v join public.inventory i on i.variant_id = v.id
      where v.product_id = x.id and v.is_active and v.deleted_at is null and lower(v.size) = any(${p.add(f.sizes, 'text[]')})
        and i.stock_quantity - i.reserved_quantity > 0)`);
  }
  if (f.colors.length) {
    where.push(`exists (select 1 from public.product_variants v
      where v.product_id = x.id and v.is_active and v.deleted_at is null and lower(v.color) = any(${p.add(f.colors, 'text[]')}))`);
  }
  if (f.minPrice !== undefined) where.push(`x.eff_price >= ${p.add(f.minPrice, 'bigint')}`);
  if (f.maxPrice !== undefined) where.push(`x.eff_price <= ${p.add(f.maxPrice, 'bigint')}`);
  if (f.minRating !== undefined) where.push(`x.rating >= ${p.add(f.minRating, 'numeric')}`);
  if (f.availability === 'in_stock') where.push(`x.available > 0`);
  if (f.availability === 'out_of_stock') where.push(`x.available <= 0`);
  if (f.sale !== undefined) where.push(f.sale ? `x.is_sale` : `not x.is_sale`);
  if (f.isNew !== undefined) where.push(f.isNew ? `x.is_new` : `not x.is_new`);
  return where.length ? where.join(' and ') : 'true';
}

function orderBy(sort: PublicSort, qRef: string | null): string {
  switch (sort) {
    case 'newest':
      return `x.created_at desc, x.id`;
    case 'price_asc':
      return `x.eff_price asc, x.id`;
    case 'price_desc':
      return `x.eff_price desc, x.id`;
    case 'rating':
      return `x.rating desc, x.review_count desc, x.id`;
    case 'popular':
      return `x.popularity desc, x.units_sold desc, x.id`;
    case 'relevance':
      if (qRef)
        return `ts_rank(x.search_vector, plainto_tsquery('simple', ${qRef})) desc, (x.available > 0) desc, x.popularity desc, x.id`;
      return orderBy('featured', null);
    case 'featured':
    default:
      return `(x.available > 0) desc, (x.popularity * 0.6 + x.rating * 8) desc, x.created_at desc, x.id`;
  }
}

// ───────────────────────── Summaries ─────────────────────────

/** Runs `select … from catalog x where … order by … limit` and hydrates summaries in one statement. */
async function selectSummaries(p: SqlParams, where: string, order: string, limit: number, offset = 0, prefix = ''): Promise<ProductSummary[]> {
  const rows = await query<SummaryRow>(
    `with ${CATALOG_CTE}${prefix},
     page as (select x.*, row_number() over (order by ${order}) as rn from catalog x where ${where}
              order by ${order} limit ${p.add(limit, 'int')} offset ${p.add(offset, 'int')})
     select ${SUMMARY_COLUMNS} from page x order by x.rn`,
    p.values,
  );
  return rows.map(toProductSummary);
}

// ───────────────────────── Facets ─────────────────────────

interface FacetOption {
  value: string;
  label: string;
  count: number;
  hex?: string;
}
interface FacetsRow {
  categories: FacetOption[] | null;
  brands: FacetOption[] | null;
  sizes: FacetOption[] | null;
  colors: FacetOption[] | null;
  genders: FacetOption[] | null;
  sports: FacetOption[] | null;
  price_min: number | null;
  price_max: number | null;
}

const FACETS_SELECT = `select
  (select json_agg(json_build_object('value', t.slug, 'label', t.name, 'count', t.n) order by t.n desc, t.name)
     from (select category_slug as slug, category_name as name, count(*)::int as n from base group by 1, 2) t) as categories,
  (select json_agg(json_build_object('value', t.slug, 'label', t.name, 'count', t.n) order by t.name)
     from (select brand_slug as slug, brand_name as name, count(*)::int as n from base group by 1, 2) t) as brands,
  (select json_agg(json_build_object('value', t.size, 'label', t.size, 'count', t.n))
     from (select v.size, count(distinct b.id)::int as n from base b
             join public.product_variants v on v.product_id = b.id and v.is_active and v.deleted_at is null
            where lower(v.size) <> 'one size' group by v.size) t) as sizes,
  (select json_agg(json_build_object('value', t.label, 'label', t.label, 'count', t.n, 'hex', t.hex) order by t.n desc, t.label)
     from (select min(v.color) as label, min(v.color_hex) as hex, count(distinct b.id)::int as n from base b
             join public.product_variants v on v.product_id = b.id and v.is_active and v.deleted_at is null
            group by lower(v.color)) t) as colors,
  (select json_agg(json_build_object('value', t.g, 'label', initcap(t.g), 'count', t.n) order by t.n desc)
     from (select lower(gender::text) as g, count(*)::int as n from base group by 1) t) as genders,
  (select json_agg(json_build_object('value', t.sport, 'label', initcap(replace(t.sport, '-', ' ')), 'count', t.n) order by t.n desc)
     from (select sport, count(*)::int as n from base group by 1) t) as sports,
  (select min(eff_price) from base) as price_min,
  (select max(eff_price) from base) as price_max`;

function mapFacets(r: FacetsRow | null) {
  return {
    categories: r?.categories ?? [],
    brands: r?.brands ?? [],
    sizes: (r?.sizes ?? []).sort((a, b) => sizeRank(a.value) - sizeRank(b.value) || a.value.localeCompare(b.value)),
    colors: r?.colors ?? [],
    genders: r?.genders ?? [],
    sports: r?.sports ?? [],
    priceRange: { min: Number(r?.price_min ?? 0), max: Number(r?.price_max ?? 0) },
  };
}

// ───────────────────────── Service ─────────────────────────

async function loadProductRow(idOrSlug: string) {
  const p = new SqlParams();
  const cond = isUuid(idOrSlug) ? `x.id = ${p.add(idOrSlug, 'uuid')}` : `x.slug = ${p.add(idOrSlug.toLowerCase())}`;
  return queryOne<{ id: string }>(`with ${CATALOG_CTE} select x.id from catalog x where ${cond}`, p.values);
}

export const publicProductsService = {
  /** Storefront listing: paginated summaries + facets for the base set (collection + q). */
  async list(f: ProductListFilters) {
    const p = new SqlParams();
    const base = baseConditions(f, p);
    const filters = filterConditions(f, p);
    const sort: PublicSort = f.sort ?? (f.q ? 'relevance' : 'featured');
    const ctes = `with ${CATALOG_CTE},
      base as (select * from catalog x where ${base}),
      filtered as (select * from base x where ${filters})`;
    // count + facets share the CTE parameters (every CTE is parsed, so each $n has a known type);
    // parameters used only by the page statement are appended after this snapshot.
    const countSql = `${ctes} select count(*)::int as n from filtered`;
    const facetsSql = `${ctes} ${FACETS_SELECT}`;
    const values = [...p.values];
    const qRef = sort === 'relevance' && f.q ? p.add(f.q, 'text') : null;
    const order = orderBy(sort, qRef);
    const limitRef = p.add(f.limit, 'int');
    const offsetRef = p.add(offsetOf(f.page, f.limit), 'int');
    const pageSql = `${ctes},
      page as (select x.*, row_number() over (order by ${order}) as rn from filtered x order by ${order} limit ${limitRef} offset ${offsetRef})
      select ${SUMMARY_COLUMNS} from page x order by x.rn`;
    const [countRow, rows, facets] = await Promise.all([
      queryOne<{ n: number }>(countSql, values),
      query<SummaryRow>(pageSql, p.values),
      queryOne<FacetsRow>(facetsSql, values),
    ]);
    const total = countRow?.n ?? 0;
    return { items: rows.map(toProductSummary), meta: pageMeta(f.page, f.limit, total), facets: mapFacets(facets) };
  },

  async featured(kind: string, limit: number) {
    const p = new SqlParams();
    let where = 'true';
    let order = orderBy('popular', null);
    switch (kind) {
      case 'new':
        where = 'x.is_new';
        order = orderBy('newest', null);
        break;
      case 'bestseller':
        where = `(x.is_featured or x.badge = 'bestseller')`;
        break;
      case 'sale':
        where = 'x.is_sale';
        break;
      case 'training':
      case 'football':
      case 'basketball':
      case 'running':
        where = `x.sport = ${p.add(kind)}`;
        break;
      default:
        where = 'x.is_featured';
        order = orderBy('featured', null);
    }
    return selectSummaries(p, where, order, limit);
  },

  /** Wishlist / recently viewed: summaries in the order requested; unknown or unpublished ids are skipped. */
  async batch(ids: string[], slugs: string[]) {
    const p = new SqlParams();
    const validIds = ids.filter(isUuid);
    const idRef = p.add(validIds, 'uuid[]');
    const slugRef = p.add(slugs.map((s) => s.toLowerCase()), 'text[]');
    return selectSummaries(
      p,
      `(x.id = any(${idRef}) or x.slug = any(${slugRef}))`,
      `coalesce(array_position(${idRef}, x.id), 1000 + array_position(${slugRef}, x.slug)), x.id`,
      60,
    );
  },

  async related(idOrSlug: string, limit: number) {
    const row = await loadProductRow(idOrSlug);
    if (!row) throw notFound('Product');
    return this.relatedTo(row.id, limit);
  },

  async relatedTo(productId: string, limit: number) {
    const p = new SqlParams();
    const id = p.add(productId, 'uuid');
    const prefix = `, self as (select category_id, sport, department from catalog where id = ${id})`;
    const score = `((x.category_id = (select category_id from self))::int * 3 + (x.sport = (select sport from self))::int * 2
      + (x.department = (select department from self))::int)`;
    return selectSummaries(
      p,
      `x.id <> ${id} and (x.category_id = (select category_id from self) or x.sport = (select sport from self))`,
      `${score} desc, x.popularity desc, x.id`,
      limit,
      0,
      prefix,
    );
  },

  async completeTheLook(idOrSlug: string, limit: number) {
    const row = await loadProductRow(idOrSlug);
    if (!row) throw notFound('Product');
    return this.completeTheLookFor(row.id, limit);
  },

  /** Curated `complete_the_look` ids first, then complementary departments from the same sport. */
  async completeTheLookFor(productId: string, limit: number) {
    const p = new SqlParams();
    const id = p.add(productId, 'uuid');
    const prefix = `, self as (select p.complete_the_look as ctl, c.sport, c.department from public.products p join catalog c on c.id = p.id where p.id = ${id})`;
    return selectSummaries(
      p,
      `x.id <> ${id} and (x.id = any(coalesce((select ctl from self), '{}'::uuid[])) or (x.sport = (select sport from self) and x.department <> (select department from self)))`,
      `(array_position((select ctl from self), x.id) is null), array_position((select ctl from self), x.id), x.popularity desc, x.id`,
      limit,
      0,
      prefix,
    );
  },

  /** Full PDP payload in one response. */
  async detail(idOrSlug: string) {
    const byId = isUuid(idOrSlug);
    const product = await queryOne<{
      id: string; slug: string; name: string; sku: string; short_description: string; description: string; department: string;
      sport: string; gender: string; product_type: string; price: number; compare_at_price: number | null; tax_rate: number | null;
      is_featured: boolean; is_new: boolean; badge: string | null; features: string[]; specifications: { label: string; value: string }[];
      tags: string[]; size_guide: string; rating: number; review_count: number; popularity: number; units_sold: number;
      seo_title: string | null; seo_description: string | null; published_at: Date | null; created_at: Date; updated_at: Date;
      brand_id: string; brand_name: string; brand_slug: string; category_id: string; category_name: string; category_slug: string;
      parent_id: string | null; parent_name: string | null; parent_slug: string | null;
    }>(
      `select p.*, b.name as brand_name, b.slug as brand_slug, c.name as category_name, c.slug as category_slug,
              c.parent_id, pc.name as parent_name, pc.slug as parent_slug
         from public.products p
         join public.brands b on b.id = p.brand_id
         join public.categories c on c.id = p.category_id
         left join public.categories pc on pc.id = c.parent_id
        where ${byId ? 'p.id = $1::uuid' : 'p.slug = $1'} and p.status = 'PUBLISHED' and p.deleted_at is null`,
      [byId ? idOrSlug : idOrSlug.toLowerCase()],
    );
    if (!product) throw notFound('Product');

    // Cheap, non-blocking view counter.
    pool.query(`update public.products set view_count = view_count + 1 where id = $1`, [product.id]).catch((err) => logger.warn({ err }, 'view_count update failed'));

    const [images, variants, promos, methods, settings, distribution, related, completeTheLook] = await Promise.all([
      query<ImageRow>(`select * from public.product_images where product_id = $1 order by (role = 'MAIN') desc, position, created_at`, [product.id]),
      query<{ id: string; sku: string; color: string; color_hex: string; size: string; price: number | null; compare_at_price: number | null;
        position: number; stock: number | null; reserved: number | null; threshold: number | null }>(
        `select v.id, v.sku, v.color, v.color_hex, v.size, v.price, v.compare_at_price, v.position,
                i.stock_quantity as stock, i.reserved_quantity as reserved, i.low_stock_threshold as threshold
           from public.product_variants v left join public.inventory i on i.variant_id = v.id
          where v.product_id = $1 and v.is_active and v.deleted_at is null order by v.position, v.created_at`,
        [product.id],
      ),
      activePromotions(),
      shippingService.listActiveMethods(),
      getStoreSettings(),
      query<{ rating: number; n: number }>(
        `select rating, count(*)::int as n from public.reviews where product_id = $1 and status = 'APPROVED' and deleted_at is null group by rating`,
        [product.id],
      ),
      this.relatedTo(product.id, 8),
      this.completeTheLookFor(product.id, 4),
    ]);

    const promoFor = (unitPrice: number) =>
      bestPromotion(promos, { productId: product.id, categoryId: product.category_id, parentCategoryId: product.parent_id, brandId: product.brand_id, unitPrice });

    const variantOut = variants.map((v) => {
      const originalPrice = v.price ?? product.price;
      const promo = promoFor(originalPrice);
      const price = originalPrice - (promo?.amount ?? 0);
      const compareAtPrice = compareAtOf(price, originalPrice, v.compare_at_price ?? product.compare_at_price, promo?.amount ?? 0);
      const available = Math.max(0, (v.stock ?? 0) - (v.reserved ?? 0));
      return {
        id: v.id,
        sku: v.sku,
        color: v.color,
        colorHex: v.color_hex,
        size: v.size,
        price,
        originalPrice,
        compareAtPrice,
        available,
        stock: available,
        stockStatus: stockStatusOf(available, v.threshold ?? 0),
      };
    });

    const imagesOut = images.map(toImage).map(({ storageKey: _k, ...rest }) => rest);
    const colors: { name: string; hex: string; imageIndex?: number }[] = [];
    for (const v of variants) {
      if (colors.some((c) => c.name.toLowerCase() === v.color.toLowerCase())) continue;
      const idx = images.findIndex((i) => i.color && i.color.toLowerCase() === v.color.toLowerCase());
      colors.push({ name: v.color, hex: v.color_hex, ...(idx >= 0 ? { imageIndex: idx } : {}) });
    }
    const sizes = sortSizes([...new Set(variants.map((v) => v.size))]);

    const basePromo = promoFor(product.price);
    const price = product.price - (basePromo?.amount ?? 0);
    const compareAtPrice = compareAtOf(price, product.price, product.compare_at_price, basePromo?.amount ?? 0);
    const available = variantOut.reduce((s, v) => s + v.available, 0);
    const maxThreshold = variants.reduce((m, v) => Math.max(m, v.threshold ?? 0), 0);
    const ratingDistribution: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    for (const d of distribution) ratingDistribution[String(d.rating)] = d.n;

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      brand: { id: product.brand_id, name: product.brand_name, slug: product.brand_slug },
      category: {
        id: product.category_id,
        name: product.category_name,
        slug: product.category_slug,
        parent: product.parent_id ? { id: product.parent_id, name: product.parent_name, slug: product.parent_slug } : null,
      },
      department: product.department,
      sport: product.sport,
      gender: genderList(product.gender),
      productType: product.product_type,
      shortDescription: product.short_description,
      description: product.description,
      images: imagesOut,
      colors,
      sizes,
      variants: variantOut,
      stock: available,
      available,
      stockStatus: stockStatusOf(available, maxThreshold),
      price,
      originalPrice: product.price,
      compareAtPrice,
      salePrice: basePromo ? price : null,
      isSale: Boolean(basePromo) || (product.compare_at_price ?? 0) > price,
      discountPercent: discountPercentOf(price, compareAtPrice),
      appliedPromotion: basePromo ? { source: basePromo.promo.source, id: basePromo.promo.id, name: basePromo.promo.name } : null,
      pricing: {
        price,
        originalPrice: product.price,
        compareAtPrice,
        salePrice: basePromo ? price : null,
        isSale: Boolean(basePromo) || (product.compare_at_price ?? 0) > price,
        discountPercent: discountPercentOf(price, compareAtPrice),
        currency: settings.currency,
      },
      rating: Number(product.rating),
      reviewCount: product.review_count,
      ratingDistribution,
      features: product.features,
      specifications: product.specifications,
      badge: product.badge,
      isNew: product.is_new,
      isFeatured: product.is_featured,
      isBestSeller: product.is_featured || product.badge === 'bestseller',
      popularity: product.popularity,
      sizeGuide: product.size_guide,
      tags: product.tags,
      seo: { title: product.seo_title ?? product.name, description: product.seo_description ?? product.short_description },
      shipping: {
        freeShippingThreshold: settings.freeShippingThreshold,
        currency: settings.currency,
        methods: methods.map((m) => ({
          code: m.code,
          name: m.name,
          description: m.description,
          price: m.price,
          freeShippingThreshold: m.freeShippingThreshold ?? settings.freeShippingThreshold,
          minDays: m.minDays,
          maxDays: m.maxDays,
          requiresAddress: m.requiresAddress,
        })),
      },
      completeTheLook,
      related,
      publishedAt: product.published_at ? product.published_at.toISOString() : null,
      createdAt: product.created_at.toISOString(),
      updatedAt: product.updated_at.toISOString(),
    };
  },
};
