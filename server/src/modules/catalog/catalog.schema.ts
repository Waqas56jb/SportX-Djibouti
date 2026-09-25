import { z } from 'zod';

/** `a,b` or repeated `?x=a&x=b` → ['a','b']. */
export const multi = () =>
  z.preprocess(
    (v) =>
      v === undefined || v === null || v === ''
        ? undefined
        : (Array.isArray(v) ? v : [v])
            .flatMap((s) => String(s).split(','))
            .map((s) => s.trim())
            .filter(Boolean),
    z.array(z.string().max(100)).max(40).optional(),
  );

export const bool = () =>
  z.preprocess((v) => {
    if (v === undefined || v === '') return undefined;
    if (v === true || v === 'true' || v === '1' || v === 'yes') return true;
    if (v === false || v === 'false' || v === '0' || v === 'no') return false;
    return v;
  }, z.boolean().optional());

export const COLLECTION_KEYS = [
  'shop', 'men', 'women', 'kids', 'football', 'basketball', 'running', 'training', 'equipment', 'new-arrivals', 'sale',
  'footwear', 'apparel', 'accessories', 'balls', 'bags', 'gym-equipment',
] as const;

export const PUBLIC_SORTS = ['featured', 'newest', 'price_asc', 'price_desc', 'rating', 'popular', 'relevance'] as const;
export type PublicSort = (typeof PUBLIC_SORTS)[number];

const sortParam = z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/-/g, '_') : v), z.enum(PUBLIC_SORTS).optional());

/** Storefront product list / search query. Singular and plural keys are both accepted (customer uses plural). */
export const productListQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(48).optional(),
    pageSize: z.coerce.number().int().min(1).max(48).optional(),
    q: z.string().trim().max(120).optional(),
    collection: z.string().trim().toLowerCase().max(80).optional(),
    category: multi(),
    categories: multi(),
    brand: multi(),
    brands: multi(),
    gender: multi(),
    genders: multi(),
    sport: multi(),
    sports: multi(),
    size: multi(),
    sizes: multi(),
    color: multi(),
    colors: multi(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    inStock: bool(),
    inStockOnly: bool(),
    availability: z.preprocess((v) => (typeof v === 'string' ? v.toLowerCase().replace(/-/g, '_') : v), z.enum(['in_stock', 'out_of_stock', 'all']).optional()),
    sale: bool(),
    new: bool(),
    sort: sortParam,
  })
  .transform((f) => ({
    page: f.page,
    limit: f.limit ?? f.pageSize ?? 12,
    q: f.q || undefined,
    collection: f.collection || undefined,
    categories: [...(f.category ?? []), ...(f.categories ?? [])].map((s) => s.toLowerCase()),
    brands: [...(f.brand ?? []), ...(f.brands ?? [])].map((s) => s.toLowerCase()),
    genders: [...(f.gender ?? []), ...(f.genders ?? [])].map((s) => s.toUpperCase()).filter((g) => ['MEN', 'WOMEN', 'KIDS', 'UNISEX'].includes(g)),
    sports: [...(f.sport ?? []), ...(f.sports ?? [])].map((s) => s.toLowerCase()),
    sizes: [...(f.size ?? []), ...(f.sizes ?? [])].map((s) => s.toLowerCase()),
    colors: [...(f.color ?? []), ...(f.colors ?? [])].map((s) => s.toLowerCase()),
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    minRating: f.minRating,
    availability: f.inStock || f.inStockOnly ? ('in_stock' as const) : f.availability === 'all' ? undefined : f.availability,
    sale: f.sale,
    isNew: f.new,
    sort: f.sort,
  }));
export type ProductListFilters = z.output<typeof productListQuery>;

export const featuredQuery = z.object({
  kind: z.enum(['new', 'bestseller', 'sale', 'training', 'football', 'basketball', 'running', 'featured']).default('featured'),
  limit: z.coerce.number().int().min(1).max(48).default(8),
});

export const batchQuery = z
  .object({ ids: multi(), slugs: multi() })
  .refine((v) => (v.ids?.length ?? 0) + (v.slugs?.length ?? 0) <= 60, 'At most 60 products per batch.');

export const limitQuery = (def: number) => z.object({ limit: z.coerce.number().int().min(1).max(24).default(def) });

export const idOrSlugParam = z.object({ idOrSlug: z.string().trim().min(1).max(160) });
export const slugParam = z.object({ slug: z.string().trim().min(1).max(160) });
