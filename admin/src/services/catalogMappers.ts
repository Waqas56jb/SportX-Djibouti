/**
 * Adapters between the SPORTX API catalogue DTOs (UPPER_SNAKE enums, nullable fields) and the
 * admin's frontend types (lower-case enums, optional fields). Pages keep using the frontend types.
 */
import type { Brand, Category, Gender, Product, ProductImage, ProductListItem, ProductStatus, ProductType, ProductVariant, Sport, StockStatus } from '@/types';

const lower = <T extends string>(v: string | null | undefined, fallback: T): T => (v ? (v.toLowerCase() as T) : fallback);

export interface ApiImage {
  id: string;
  url: string;
  alt: string;
  role: 'MAIN' | 'GALLERY' | 'HOVER';
  color: string | null;
  position: number;
  storageKey: string | null;
}

export interface ApiVariant {
  id: string;
  productId: string;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  price: number | null;
  compareAtPrice: number | null;
  stock: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  stockStatus: string;
  barcode: string | null;
  weightGrams: number | null;
  position: number;
  isActive: boolean;
}

export interface ApiProductRow {
  id: string;
  name: string;
  slug: string;
  sku: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  department: string;
  sport: string;
  gender: string;
  productType: string;
  status: string;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  taxRate: number | null;
  shortDescription: string;
  description: string;
  specifications: { label: string; value: string }[];
  tags: string[];
  isFeatured: boolean;
  seo: { title: string; description: string; keywords: string[] };
  image: string | null;
  totalStock: number;
  available: number;
  reserved: number;
  stockStatus: string;
  variantsCount: number;
  unitsSold: number;
  revenue: number;
  views: number;
  rating: number;
  reviewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProduct extends ApiProductRow {
  images: ApiImage[];
  variants: ApiVariant[];
}

export const toImage = (i: ApiImage): ProductImage => ({
  id: i.id,
  url: i.url,
  alt: i.alt ?? '',
  role: lower(i.role, 'gallery'),
  position: i.position,
  storageKey: i.storageKey ?? undefined,
  color: i.color ?? undefined,
});

export const toVariant = (v: ApiVariant): ProductVariant => ({
  id: v.id,
  productId: v.productId,
  sku: v.sku,
  color: v.color,
  colorHex: v.colorHex,
  size: v.size,
  price: v.price ?? undefined,
  stock: v.stock,
  reserved: v.reserved,
  lowStockThreshold: v.lowStockThreshold,
  barcode: v.barcode ?? undefined,
});

function baseProduct(p: ApiProductRow): Omit<Product, 'images' | 'variants'> {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    brandId: p.brandId,
    categoryId: p.categoryId,
    sport: (p.sport as Sport) ?? 'multi-sport',
    gender: lower<Gender>(p.gender, 'unisex'),
    type: p.productType as ProductType,
    status: lower<ProductStatus>(p.status, 'draft'),
    price: p.price,
    compareAtPrice: p.compareAtPrice ?? undefined,
    costPrice: p.costPrice ?? undefined,
    taxRate: p.taxRate ?? 0,
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    specs: p.specifications ?? [],
    seo: { title: p.seo?.title ?? '', description: p.seo?.description ?? '', keywords: p.seo?.keywords ?? p.tags ?? [] },
    tags: p.tags ?? [],
    featured: p.isFeatured,
    unitsSold: p.unitsSold ?? 0,
    revenue: p.revenue ?? 0,
    views: p.views ?? 0,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    publishedAt: p.publishedAt ?? undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

const listExtras = (p: ApiProductRow) => ({
  brandName: p.brandName,
  categoryName: p.categoryName,
  totalStock: p.totalStock,
  available: p.available,
  stockStatus: lower<StockStatus>(p.stockStatus, 'in_stock'),
  image: p.image ?? undefined,
  variantsCount: p.variantsCount,
});

/** List row → ProductListItem. `images` holds only the main image; `variants` is empty (see variantsCount). */
export function toProductListItem(p: ApiProductRow): ProductListItem {
  return {
    ...baseProduct(p),
    images: p.image ? [{ id: `${p.id}-main`, url: p.image, alt: p.name, role: 'main', position: 0 }] : [],
    variants: [],
    ...listExtras(p),
  };
}

/** Full product (GET /admin/products/:id) → ProductListItem with images + variants. */
export function toProduct(p: ApiProduct): ProductListItem {
  return {
    ...baseProduct(p),
    images: [...(p.images ?? [])].sort((a, b) => a.position - b.position).map(toImage),
    variants: (p.variants ?? []).map(toVariant),
    ...listExtras(p),
    variantsCount: p.variants?.length ?? p.variantsCount,
  };
}

// ─── Categories & brands ────────────────────────────────────────────────────

export interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  parentId: string | null;
  status: 'active' | 'inactive';
  position: number;
  seoTitle: string;
  seoDescription: string;
  depth: number;
  productCount: number;
  totalProductCount: number;
  childrenCount: number;
  createdAt: string;
  updatedAt: string;
}

export const toCategory = (c: ApiCategory): Category => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  description: c.description ?? '',
  imageUrl: c.imageUrl ?? undefined,
  parentId: c.parentId,
  status: c.status,
  position: c.position,
  productCount: c.productCount,
  seoTitle: c.seoTitle ?? '',
  seoDescription: c.seoDescription ?? '',
  depth: c.depth,
  totalProductCount: c.totalProductCount,
  childrenCount: c.childrenCount,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

export interface ApiBrand {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
  website: string | null;
  productCount: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export const toBrand = (b: ApiBrand): Brand => ({
  id: b.id,
  name: b.name,
  slug: b.slug,
  description: b.description ?? '',
  logoUrl: b.logoUrl ?? undefined,
  website: b.website ?? '',
  status: b.status,
  productCount: b.productCount,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
});

/** True for URLs the API can store (http/https) — excludes local blob: previews. */
export const isRemoteUrl = (u: string | undefined | null): u is string => Boolean(u && /^https?:\/\//i.test(u));

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
