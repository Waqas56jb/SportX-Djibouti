import { sortSizes, stockStatusOf, type StockStatus } from './catalog.sql.js';

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

/** Storefront gender list (customer `Product.gender: Gender[]`). */
export const genderList = (g: string) => [g.toLowerCase()];

/** Mirrors pricing.priceCart: a compare-at price is shown when it is above the effective price, else the pre-promo price. */
export function compareAtOf(effective: number, original: number, compareAt: number | null, promo: number): number | null {
  if (compareAt && compareAt > effective) return compareAt;
  return promo > 0 ? original : null;
}
export const discountPercentOf = (effective: number, compareAt: number | null) =>
  compareAt && compareAt > effective ? Math.round(((compareAt - effective) / compareAt) * 100) : 0;

// ───────────────────────── Public product summary ─────────────────────────

export interface SummaryRow {
  id: string;
  slug: string;
  name: string;
  sku: string;
  department: string;
  sport: string;
  gender: string;
  price: number;
  compare_at_price: number | null;
  eff_price: number;
  promo_discount: number;
  is_sale: boolean;
  rating: number;
  review_count: number;
  popularity: number;
  units_sold: number;
  is_new: boolean;
  is_featured: boolean;
  badge: string | null;
  short_description: string;
  created_at: Date;
  brand_name: string;
  brand_slug: string;
  category_slug: string;
  category_name: string;
  available: number;
  low_threshold: number;
  image: string | null;
  hover_image: string | null;
  colors: { name: string; hex: string }[];
  sizes: string[];
}

export function toProductSummary(r: SummaryRow) {
  const price = Number(r.eff_price);
  const compareAtPrice = compareAtOf(price, r.price, r.compare_at_price, Number(r.promo_discount));
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    brand: { name: r.brand_name, slug: r.brand_slug },
    category: { slug: r.category_slug, name: r.category_name },
    department: r.department,
    sport: r.sport,
    gender: genderList(r.gender),
    shortDescription: r.short_description,
    price,
    originalPrice: r.price,
    compareAtPrice,
    isSale: r.is_sale,
    discountPercent: discountPercentOf(price, compareAtPrice),
    image: r.image,
    hoverImage: r.hover_image,
    colors: r.colors ?? [],
    sizes: sortSizes(r.sizes ?? []),
    rating: Number(r.rating),
    reviewCount: r.review_count,
    badge: r.badge,
    isNew: r.is_new,
    isFeatured: r.is_featured,
    isBestSeller: r.is_featured || r.badge === 'bestseller',
    popularity: r.popularity,
    stockStatus: stockStatusOf(r.available, r.low_threshold),
    available: r.available,
    createdAt: iso(r.created_at),
  };
}
export type ProductSummary = ReturnType<typeof toProductSummary>;

// ───────────────────────── Categories & brands ─────────────────────────

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  image_path?: string | null;
  is_active: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: Date;
  updated_at: Date;
  product_count?: number;
}

export const toPublicCategory = (r: CategoryRow, productCount: number) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  imageUrl: r.image_url,
  parentId: r.parent_id,
  sortOrder: r.sort_order,
  productCount,
  seoTitle: r.seo_title,
  seoDescription: r.seo_description,
});

export const toAdminCategory = (r: CategoryRow, extra: { depth: number; productCount: number; totalProductCount: number; childrenCount: number }) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  imageUrl: r.image_url,
  parentId: r.parent_id,
  status: r.is_active ? 'active' : 'inactive',
  isActive: r.is_active,
  position: r.sort_order,
  sortOrder: r.sort_order,
  seoTitle: r.seo_title ?? '',
  seoDescription: r.seo_description ?? '',
  depth: extra.depth,
  productCount: extra.productCount,
  totalProductCount: extra.totalProductCount,
  childrenCount: extra.childrenCount,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  logo_path?: string | null;
  website: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  product_count: number;
}

export const toPublicBrand = (r: BrandRow) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  logoUrl: r.logo_url,
  website: r.website,
  productCount: r.product_count,
});

export const toAdminBrand = (r: BrandRow) => ({
  ...toPublicBrand(r),
  website: r.website ?? '',
  status: r.is_active ? 'active' : 'inactive',
  isActive: r.is_active,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

// ───────────────────────── Admin product ─────────────────────────

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  sku: string;
  short_description: string;
  description: string;
  brand_id: string;
  category_id: string;
  department: string;
  sport: string;
  gender: string;
  product_type: string;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  tax_rate: number | null;
  status: string;
  is_featured: boolean;
  is_new: boolean;
  badge: string | null;
  features: string[];
  specifications: { label: string; value: string }[];
  tags: string[];
  size_guide: string;
  complete_the_look: string[];
  rating: number;
  review_count: number;
  units_sold: number;
  view_count: number;
  popularity: number;
  seo_title: string | null;
  seo_description: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  brand_name: string;
  category_name: string;
  total_stock: number;
  available: number;
  reserved: number;
  threshold: number;
  variants_count: number;
  main_image: string | null;
  revenue?: number;
}

export interface AdminVariantRow {
  id: string;
  product_id: string;
  sku: string;
  color: string;
  color_hex: string;
  size: string;
  price: number | null;
  compare_at_price: number | null;
  weight_grams: number | null;
  barcode: string | null;
  position: number;
  is_active: boolean;
  stock_quantity: number | null;
  reserved_quantity: number | null;
  low_stock_threshold: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ImageRow {
  id: string;
  product_id: string;
  url: string;
  storage_path: string | null;
  alt: string;
  role: 'MAIN' | 'GALLERY' | 'HOVER';
  color: string | null;
  position: number;
  created_at: Date;
}

export const toImage = (r: ImageRow) => ({
  id: r.id,
  url: r.url,
  alt: r.alt,
  role: r.role,
  color: r.color,
  position: r.position,
  storageKey: r.storage_path,
});

export function toAdminVariant(r: AdminVariantRow) {
  const stock = r.stock_quantity ?? 0;
  const reserved = r.reserved_quantity ?? 0;
  const threshold = r.low_stock_threshold ?? 0;
  return {
    id: r.id,
    productId: r.product_id,
    sku: r.sku,
    color: r.color,
    colorHex: r.color_hex,
    size: r.size,
    price: r.price,
    compareAtPrice: r.compare_at_price,
    stock,
    reserved,
    available: Math.max(0, stock - reserved),
    lowStockThreshold: threshold,
    stockStatus: stockStatusOf(stock - reserved, threshold),
    barcode: r.barcode,
    weightGrams: r.weight_grams,
    position: r.position,
    isActive: r.is_active,
  };
}

export function toAdminProductRow(r: AdminProductRow) {
  const stockStatus: StockStatus = stockStatusOf(r.available, r.threshold);
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    sku: r.sku,
    brandId: r.brand_id,
    brandName: r.brand_name,
    categoryId: r.category_id,
    categoryName: r.category_name,
    department: r.department,
    sport: r.sport,
    gender: r.gender,
    type: r.product_type,
    productType: r.product_type,
    status: r.status,
    price: r.price,
    compareAtPrice: r.compare_at_price,
    costPrice: r.cost_price,
    taxRate: r.tax_rate === null ? null : Number(r.tax_rate),
    shortDescription: r.short_description,
    description: r.description,
    features: r.features,
    specifications: r.specifications,
    specs: r.specifications,
    tags: r.tags,
    sizeGuide: r.size_guide,
    badge: r.badge,
    isNew: r.is_new,
    isFeatured: r.is_featured,
    featured: r.is_featured,
    completeTheLook: r.complete_the_look,
    seo: { title: r.seo_title ?? '', description: r.seo_description ?? '', keywords: r.tags },
    image: r.main_image,
    totalStock: r.total_stock,
    available: r.available,
    reserved: r.reserved,
    stockStatus,
    variantsCount: r.variants_count,
    unitsSold: r.units_sold,
    revenue: r.revenue ?? 0,
    views: r.view_count,
    rating: Number(r.rating),
    reviewCount: r.review_count,
    popularity: r.popularity,
    publishedAt: iso(r.published_at),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    deletedAt: iso(r.deleted_at),
  };
}

export const toAdminProduct = (r: AdminProductRow, variants: AdminVariantRow[], images: ImageRow[]) => ({
  ...toAdminProductRow(r),
  images: images.map(toImage),
  variants: variants.map(toAdminVariant),
});
