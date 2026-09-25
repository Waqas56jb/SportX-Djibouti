import { CATEGORY_LABELS, GENDER_LABELS, SPORT_LABELS } from '@/constants/labels';
import { PRODUCTS_PAGE_SIZE } from '@/constants/commerce';
import { getCollection } from '@/data/collections';
import { PRODUCTS } from '@/data/products';
import type { FacetOption, Product, ProductFacets, ProductListResult, ProductQuery, SortKey } from '@/types';
import { apiClient } from './api/client';
import { USE_MOCK_API } from './config';
import { delay } from './mock/db';

// ───────────────────────── Mock query engine ─────────────────────────

const normalise = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, '');

function matchesText(p: Product, q: string) {
  const terms = normalise(q).split(/\s+/).filter(Boolean);
  const haystack = normalise(
    [p.name, p.brand, p.category, CATEGORY_LABELS[p.category], p.sport, p.department, ...p.tags, ...p.gender].join(' '),
  );
  // Every term must match; allow simple plural stripping ("boots" → "boot").
  return terms.every((t) => haystack.includes(t) || (t.endsWith('s') && haystack.includes(t.slice(0, -1))));
}

function baseSet(query: ProductQuery) {
  const collection = query.collection ? getCollection(query.collection) : undefined;
  let list = collection ? PRODUCTS.filter(collection.match) : PRODUCTS;
  if (query.q?.trim()) list = list.filter((p) => matchesText(p, query.q as string));
  return list;
}

function applyFilters(list: Product[], q: ProductQuery) {
  return list.filter((p) => {
    if (q.categories?.length && !q.categories.includes(p.category)) return false;
    if (q.brands?.length && !q.brands.includes(p.brand)) return false;
    if (q.sports?.length && !q.sports.includes(p.sport)) return false;
    if (q.genders?.length && !q.genders.some((g) => p.gender.includes(g))) return false;
    if (q.colors?.length && !p.colors.some((c) => q.colors?.includes(c.name))) return false;
    if (q.sizes?.length && !p.variants.some((v) => q.sizes?.includes(v.size) && v.stock > 0)) return false;
    if (q.minPrice !== undefined && p.price < q.minPrice) return false;
    if (q.maxPrice !== undefined && p.price > q.maxPrice) return false;
    if (q.minRating !== undefined && p.rating < q.minRating) return false;
    if (q.inStockOnly && p.stock <= 0) return false;
    return true;
  });
}

const SORTERS: Record<SortKey, (a: Product, b: Product) => number> = {
  featured: (a, b) => Number(b.stock > 0) - Number(a.stock > 0) || b.popularity * 0.6 + b.rating * 8 - (a.popularity * 0.6 + a.rating * 8),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
  popular: (a, b) => b.popularity - a.popularity,
};

function count(list: Product[], pick: (p: Product) => string[], label: (v: string) => string, hex?: (v: string) => string): FacetOption[] {
  const map = new Map<string, number>();
  list.forEach((p) => new Set(pick(p)).forEach((v) => map.set(v, (map.get(v) ?? 0) + 1)));
  return [...map.entries()].map(([value, n]) => ({ value, label: label(value), count: n, hex: hex?.(value) }));
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(s);
  if (i >= 0) return i;
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? 999 : 100 + n;
};

function buildFacets(list: Product[]): ProductFacets {
  const hexByColor = new Map<string, string>();
  list.forEach((p) => p.colors.forEach((c) => hexByColor.set(c.name, c.hex)));
  const prices = list.map((p) => p.price);
  return {
    categories: count(list, (p) => [p.category], (v) => CATEGORY_LABELS[v as Product['category']] ?? v).sort((a, b) => b.count - a.count),
    brands: count(list, (p) => [p.brand], (v) => v).sort((a, b) => a.label.localeCompare(b.label)),
    sizes: count(list, (p) => p.sizes, (v) => v)
      .filter((o) => o.value !== 'One Size')
      .sort((a, b) => sizeRank(a.value) - sizeRank(b.value)),
    colors: count(list, (p) => p.colors.map((c) => c.name), (v) => v, (v) => hexByColor.get(v) ?? '#ccc').sort((a, b) => b.count - a.count),
    genders: count(list, (p) => p.gender, (v) => GENDER_LABELS[v as Product['gender'][number]] ?? v),
    sports: count(list, (p) => [p.sport], (v) => SPORT_LABELS[v as Product['sport']] ?? v),
    priceRange: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
  };
}

// ───────────────────────── Public API ─────────────────────────

export const productService = {
  async list(query: ProductQuery, signal?: AbortSignal): Promise<ProductListResult> {
    if (!USE_MOCK_API) return apiClient.get<ProductListResult>('/products', { ...query }, signal);
    await delay();
    const base = baseSet(query);
    const filtered = applyFilters(base, query).sort(SORTERS[query.sort ?? 'featured']);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = query.pageSize ?? PRODUCTS_PAGE_SIZE;
    // "Load more" pagination: return everything up to the requested page.
    const items = filtered.slice(0, page * pageSize);
    return { items, total: filtered.length, page, pageSize, hasMore: items.length < filtered.length, facets: buildFacets(base) };
  },

  async getBySlug(slug: string): Promise<Product | null> {
    if (!USE_MOCK_API) return apiClient.get<Product | null>(`/products/${slug}`);
    await delay(200, 450);
    return PRODUCTS.find((p) => p.slug === slug) ?? null;
  },

  async getByIds(ids: string[]): Promise<Product[]> {
    if (!ids.length) return [];
    if (!USE_MOCK_API) return apiClient.get<Product[]>('/products/batch', { ids });
    await delay(150, 350);
    return ids.map((id) => PRODUCTS.find((p) => p.id === id)).filter((p): p is Product => Boolean(p));
  },

  async getBySlugs(slugs: string[]): Promise<Product[]> {
    if (!slugs.length) return [];
    if (!USE_MOCK_API) return apiClient.get<Product[]>('/products/batch', { slugs });
    await delay(150, 350);
    return slugs.map((s) => PRODUCTS.find((p) => p.slug === s)).filter((p): p is Product => Boolean(p));
  },

  async getFeatured(kind: 'new' | 'bestseller' | 'sale' | 'training' | 'football' | 'basketball', limit = 8): Promise<Product[]> {
    if (!USE_MOCK_API) return apiClient.get<Product[]>('/products/featured', { kind, limit });
    await delay(200, 500);
    const pick: Record<typeof kind, (p: Product) => boolean> = {
      new: (p) => p.isNew,
      bestseller: (p) => p.isBestSeller,
      sale: (p) => (p.compareAtPrice ?? 0) > p.price,
      training: (p) => p.sport === 'training',
      football: (p) => p.sport === 'football',
      basketball: (p) => p.sport === 'basketball',
    };
    const sorter = kind === 'new' ? SORTERS.newest : SORTERS.popular;
    return PRODUCTS.filter(pick[kind]).sort(sorter).slice(0, limit);
  },

  async getRelated(product: Product, limit = 8): Promise<Product[]> {
    if (!USE_MOCK_API) return apiClient.get<Product[]>(`/products/${product.slug}/related`, { limit });
    await delay(200, 450);
    const score = (p: Product) =>
      (p.category === product.category ? 3 : 0) + (p.sport === product.sport ? 2 : 0) + (p.department === product.department ? 1 : 0);
    return PRODUCTS.filter((p) => p.id !== product.id && score(p) > 0)
      .sort((a, b) => score(b) - score(a) || b.popularity - a.popularity)
      .slice(0, limit);
  },

  async getCompleteTheLook(product: Product, limit = 4): Promise<Product[]> {
    if (!USE_MOCK_API) return apiClient.get<Product[]>(`/products/${product.slug}/complete-the-look`, { limit });
    await delay(200, 450);
    const curated = (product.completeTheLook ?? []).map((id) => PRODUCTS.find((p) => p.id === id)).filter((p): p is Product => Boolean(p));
    if (curated.length >= limit) return curated.slice(0, limit);
    // Fill with complementary departments from the same sport.
    const fill = PRODUCTS.filter(
      (p) => p.id !== product.id && p.sport === product.sport && p.department !== product.department && !curated.includes(p),
    ).sort(SORTERS.popular);
    return [...curated, ...fill].slice(0, limit);
  },

  async search(q: string, limit = 6): Promise<Product[]> {
    if (!q.trim()) return [];
    if (!USE_MOCK_API) return apiClient.get<Product[]>('/products/search', { q, limit });
    await delay(120, 280);
    return PRODUCTS.filter((p) => matchesText(p, q)).sort(SORTERS.popular).slice(0, limit);
  },
};
