import { CATEGORY_LABELS } from '@/constants/labels';
import { PRODUCTS_PAGE_SIZE } from '@/constants/commerce';
import type {
  CatalogCategory,
  Department,
  FacetOption,
  Gender,
  Product,
  ProductBadge,
  ProductCategory,
  ProductColor,
  ProductFacets,
  ProductImage,
  ProductListResult,
  ProductQuery,
  ProductShippingInfo,
  SizeGuideType,
  Sport,
  StockStatus,
} from '@/types';
import { ApiError, api, requestPage } from './api';

// ───────────────────────── API shapes ─────────────────────────

interface ApiColor {
  name: string;
  hex: string;
}

/** `GET /products`, `/search`, `/featured`, `/batch`, related & complete-the-look items. */
export interface ApiProductSummary {
  id: string;
  slug: string;
  name: string;
  brand: { name: string; slug: string };
  category: { slug: string; name: string };
  department: string;
  sport: string;
  gender: string[];
  shortDescription: string;
  price: number;
  originalPrice: number;
  compareAtPrice: number | null;
  isSale: boolean;
  discountPercent: number;
  image: string | null;
  hoverImage: string | null;
  colors: ApiColor[];
  sizes: string[];
  rating: number;
  reviewCount: number;
  badge: string | null;
  isNew: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  popularity: number;
  stockStatus: StockStatus;
  available: number;
  createdAt: string | null;
}

interface ApiVariant {
  id: string;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  price: number;
  originalPrice: number;
  compareAtPrice: number | null;
  available: number;
  stock: number;
  stockStatus: StockStatus;
}

interface ApiImage {
  id: string;
  url: string;
  alt: string;
  role: 'MAIN' | 'GALLERY' | 'HOVER';
  color: string | null;
  position: number;
}

/** `GET /products/:idOrSlug`. */
export interface ApiProductDetail {
  id: string;
  slug: string;
  name: string;
  sku: string;
  brand: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string; parent: { id: string; name: string; slug: string } | null };
  department: string;
  sport: string;
  gender: string[];
  productType: string;
  shortDescription: string;
  description: string;
  images: ApiImage[];
  colors: ApiColor[];
  sizes: string[];
  variants: ApiVariant[];
  stock: number;
  available: number;
  stockStatus: StockStatus;
  price: number;
  originalPrice: number;
  compareAtPrice: number | null;
  salePrice: number | null;
  isSale: boolean;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  ratingDistribution: Record<string, number>;
  features: string[];
  specifications: { label: string; value: string }[];
  badge: string | null;
  isNew: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  popularity: number;
  sizeGuide: string;
  tags: string[];
  shipping: ProductShippingInfo | null;
  completeTheLook: ApiProductSummary[];
  related: ApiProductSummary[];
  createdAt: string;
}

type ApiFacets = Partial<ProductFacets>;

// ───────────────────────── Adapters (API → UI types) ─────────────────────────

const BADGES: ProductBadge[] = ['new', 'bestseller', 'limited', 'exclusive'];
const SIZE_GUIDES: SizeGuideType[] = ['footwear', 'apparel', 'gloves', 'ball', 'none'];

const toBadge = (b: string | null | undefined): ProductBadge | undefined => (b && BADGES.includes(b as ProductBadge) ? (b as ProductBadge) : undefined);
const toSizeGuide = (g: string | null | undefined): SizeGuideType => (g && SIZE_GUIDES.includes(g as SizeGuideType) ? (g as SizeGuideType) : 'none');
const toGenders = (g: string[] | undefined): Gender[] => (g ?? []).map((x) => x.toLowerCase() as Gender);
const compareAt = (price: number, compare: number | null | undefined) => (compare && compare > price ? compare : undefined);

/** Category display name: API name first, then the static label, then the slug. */
export const categoryLabel = (p: Pick<Product, 'category' | 'categoryName'>) =>
  p.categoryName ?? CATEGORY_LABELS[p.category as ProductCategory] ?? p.category;

/** List/summary product → UI Product. No variants: open the detail (or Quick View) before adding to the bag. */
export function toProductFromSummary(s: ApiProductSummary): Product {
  const images: ProductImage[] = [];
  if (s.image) images.push({ url: s.image, alt: s.name });
  if (s.hoverImage && s.hoverImage !== s.image) images.push({ url: s.hoverImage, alt: '' });
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    brand: s.brand?.name ?? '',
    brandSlug: s.brand?.slug,
    department: s.department as Department,
    category: s.category?.slug ?? '',
    categoryName: s.category?.name,
    sport: s.sport as Sport,
    gender: toGenders(s.gender),
    shortDescription: s.shortDescription ?? '',
    description: '',
    price: s.price,
    compareAtPrice: compareAt(s.price, s.compareAtPrice),
    rating: Number(s.rating) || 0,
    reviewCount: s.reviewCount ?? 0,
    images: images.length ? images : [{ url: '', alt: s.name }],
    colors: (s.colors ?? []).map((c) => ({ name: c.name, hex: c.hex })),
    sizes: s.sizes ?? [],
    variants: [],
    stock: s.available ?? 0,
    stockStatus: s.stockStatus,
    features: [],
    specifications: [],
    badge: toBadge(s.badge),
    isNew: Boolean(s.isNew),
    isBestSeller: Boolean(s.isBestSeller),
    popularity: s.popularity ?? 0,
    createdAt: s.createdAt ?? '',
    sizeGuide: 'none',
    tags: [],
    isSummary: true,
  };
}

/** Full product detail → UI Product (variants, gallery, colour → image mapping, extras). */
export function toProductFromDetail(d: ApiProductDetail): Product {
  const sorted = [...(d.images ?? [])].sort((a, b) => a.position - b.position);
  // Main image first, hover image last, gallery in between.
  const rank = (r: ApiImage['role']) => (r === 'MAIN' ? 0 : r === 'GALLERY' ? 1 : 2);
  const ordered = sorted.sort((a, b) => rank(a.role) - rank(b.role) || a.position - b.position);
  const images: ProductImage[] = ordered.map((i) => ({ url: i.url, alt: i.alt || d.name, color: i.color }));
  const colors: ProductColor[] = (d.colors ?? []).map((c) => {
    const idx = images.findIndex((i) => i.color && i.color.toLowerCase() === c.name.toLowerCase());
    return { name: c.name, hex: c.hex, imageIndex: idx >= 0 ? idx : undefined };
  });
  const dist = d.ratingDistribution ?? {};
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    brand: d.brand?.name ?? '',
    brandSlug: d.brand?.slug,
    department: d.department as Department,
    category: d.category?.slug ?? '',
    categoryName: d.category?.name,
    sport: d.sport as Sport,
    gender: toGenders(d.gender),
    shortDescription: d.shortDescription ?? '',
    description: d.description ?? '',
    price: d.price,
    compareAtPrice: compareAt(d.price, d.compareAtPrice),
    rating: Number(d.rating) || 0,
    reviewCount: d.reviewCount ?? 0,
    images: images.length ? images : [{ url: '', alt: d.name }],
    colors,
    sizes: d.sizes ?? [],
    variants: (d.variants ?? []).map((v) => ({
      id: v.id,
      sku: v.sku,
      color: v.color,
      size: v.size,
      stock: v.available ?? 0,
      stockStatus: v.stockStatus,
      price: v.price,
      compareAtPrice: compareAt(v.price, v.compareAtPrice),
    })),
    stock: d.available ?? 0,
    stockStatus: d.stockStatus,
    features: d.features ?? [],
    specifications: d.specifications ?? [],
    badge: toBadge(d.badge),
    isNew: Boolean(d.isNew),
    isBestSeller: Boolean(d.isBestSeller),
    popularity: d.popularity ?? 0,
    createdAt: d.createdAt ?? '',
    sizeGuide: toSizeGuide(d.sizeGuide),
    tags: d.tags ?? [],
    ratingDistribution: { 1: dist['1'] ?? 0, 2: dist['2'] ?? 0, 3: dist['3'] ?? 0, 4: dist['4'] ?? 0, 5: dist['5'] ?? 0 },
    relatedProducts: (d.related ?? []).map(toProductFromSummary),
    lookProducts: (d.completeTheLook ?? []).map(toProductFromSummary),
    shipping: d.shipping ?? undefined,
  };
}

const EMPTY_FACETS: ProductFacets = { categories: [], brands: [], sizes: [], colors: [], genders: [], sports: [], priceRange: { min: 0, max: 0 } };

function toFacets(f: ApiFacets | undefined): ProductFacets {
  const list = (x: FacetOption[] | undefined) => x ?? [];
  return {
    categories: list(f?.categories),
    brands: list(f?.brands),
    sizes: list(f?.sizes),
    colors: list(f?.colors),
    genders: list(f?.genders),
    sports: list(f?.sports),
    priceRange: f?.priceRange ?? EMPTY_FACETS.priceRange,
  };
}

/** ProductQuery → API query string params (plural keys; empty values are dropped by the client). */
function toApiQuery(q: ProductQuery) {
  return {
    page: q.page ?? 1,
    limit: q.pageSize ?? PRODUCTS_PAGE_SIZE,
    q: q.q?.trim() || undefined,
    collection: q.collection,
    categories: q.categories?.length ? q.categories.join(',') : undefined,
    brands: q.brands?.length ? q.brands.join(',') : undefined,
    sizes: q.sizes?.length ? q.sizes.join(',') : undefined,
    colors: q.colors?.length ? q.colors.join(',') : undefined,
    genders: q.genders?.length ? q.genders.join(',') : undefined,
    sports: q.sports?.length ? q.sports.join(',') : undefined,
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    minRating: q.minRating,
    inStock: q.inStockOnly ? 'true' : undefined,
    sort: q.sort && q.sort !== 'featured' ? q.sort : undefined,
  };
}

const notFound = (err: unknown) => err instanceof ApiError && err.status === 404;

export type FeaturedKind = 'new' | 'bestseller' | 'sale' | 'training' | 'football' | 'basketball' | 'running' | 'featured';

// ───────────────────────── Public API ─────────────────────────

export const productService = {
  /**
   * One page of the catalogue (`GET /products`, or `/products/search` when `q` is set).
   * The API returns a single page — callers append pages for "load more".
   */
  async list(query: ProductQuery, signal?: AbortSignal): Promise<ProductListResult> {
    const path = query.q?.trim() ? '/products/search' : '/products';
    const res = await requestPage<ApiProductSummary, { facets?: ApiFacets }>(path, { query: toApiQuery(query), signal });
    return {
      items: res.data.map(toProductFromSummary),
      total: res.pagination.total,
      page: res.pagination.page,
      pageSize: res.pagination.limit,
      hasMore: res.pagination.hasNext,
      facets: toFacets(res.facets),
    };
  },

  /** Full product (variants, images, related, complete-the-look, shipping info). Null when not found. */
  async getBySlug(slug: string): Promise<Product | null> {
    if (!slug) return null;
    try {
      return toProductFromDetail(await api.get<ApiProductDetail>(`/products/${encodeURIComponent(slug)}`));
    } catch (err) {
      if (notFound(err)) return null;
      throw err;
    }
  },

  /** Summaries by id, in the requested order (`GET /products/batch?ids=`). */
  async getByIds(ids: string[]): Promise<Product[]> {
    const unique = [...new Set(ids.filter(Boolean))].slice(0, 60);
    if (!unique.length) return [];
    const rows = await api.get<ApiProductSummary[]>('/products/batch', { ids: unique.join(',') });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return unique.map((id) => byId.get(id)).filter((r): r is ApiProductSummary => Boolean(r)).map(toProductFromSummary);
  },

  /** Summaries by slug, in the requested order (`GET /products/batch?slugs=`) — recently viewed. */
  async getBySlugs(slugs: string[]): Promise<Product[]> {
    const unique = [...new Set(slugs.filter(Boolean))].slice(0, 60);
    if (!unique.length) return [];
    const rows = await api.get<ApiProductSummary[]>('/products/batch', { slugs: unique.join(',') });
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    return unique.map((s) => bySlug.get(s)).filter((r): r is ApiProductSummary => Boolean(r)).map(toProductFromSummary);
  },

  /** Home / merchandising shelves (`GET /products/featured?kind=`). */
  async getFeatured(kind: FeaturedKind, limit = 8): Promise<Product[]> {
    const rows = await api.get<ApiProductSummary[]>('/products/featured', { kind, limit });
    return rows.map(toProductFromSummary);
  },

  /** Related products — uses the detail payload when present, otherwise `GET /products/:slug/related`. */
  async getRelated(product: Product, limit = 8): Promise<Product[]> {
    if (product.relatedProducts) return product.relatedProducts.slice(0, limit);
    const rows = await api.get<ApiProductSummary[]>(`/products/${encodeURIComponent(product.slug)}/related`, { limit: Math.min(limit, 24) });
    return rows.map(toProductFromSummary);
  },

  /** "Complete the look" — from the detail payload when present, otherwise the dedicated endpoint. */
  async getCompleteTheLook(product: Product, limit = 4): Promise<Product[]> {
    if (product.lookProducts) return product.lookProducts.slice(0, limit);
    const rows = await api.get<ApiProductSummary[]>(`/products/${encodeURIComponent(product.slug)}/complete-the-look`, { limit: Math.min(limit, 24) });
    return rows.map(toProductFromSummary);
  },

  /** Instant search for the header overlay (`GET /products/search`). */
  async search(q: string, limit = 6, signal?: AbortSignal): Promise<{ items: Product[]; total: number }> {
    const term = q.trim();
    if (!term) return { items: [], total: 0 };
    const res = await requestPage<ApiProductSummary>('/products/search', { query: { q: term, limit, sort: 'relevance' }, signal });
    return { items: res.data.map(toProductFromSummary), total: res.pagination.total };
  },

  /** Category tree (`GET /categories`). */
  categories(): Promise<CatalogCategory[]> {
    return api.get<CatalogCategory[]>('/categories');
  },

  /** One category with children and breadcrumb (`GET /categories/:slug`). Null when not found. */
  async category(slug: string): Promise<CatalogCategory | null> {
    try {
      return await api.get<CatalogCategory>(`/categories/${encodeURIComponent(slug)}`);
    } catch (err) {
      if (notFound(err)) return null;
      throw err;
    }
  },
};
