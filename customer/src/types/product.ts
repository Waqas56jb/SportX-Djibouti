export type Gender = 'men' | 'women' | 'kids' | 'unisex';

export type Sport = 'football' | 'basketball' | 'running' | 'training' | 'lifestyle';

export type Department = 'footwear' | 'apparel' | 'equipment' | 'accessories';

/** Known category slugs (the catalogue is managed in the admin, so any slug string is accepted). */
export type ProductCategory =
  | 'football-boots'
  | 'turf-shoes'
  | 'jerseys'
  | 'team-kits'
  | 'polo-shirts'
  | 't-shirts'
  | 'shorts'
  | 'tracksuits'
  | 'socks'
  | 'bags'
  | 'goalkeeper-gloves'
  | 'balls';

export type ProductBadge = 'new' | 'bestseller' | 'limited' | 'exclusive';

export type SizeGuideType = 'footwear' | 'apparel' | 'gloves' | 'ball' | 'none';

/** Server stock status (API: IN_STOCK | LOW_STOCK | OUT_OF_STOCK). */
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface ProductImage {
  url: string;
  alt: string;
  /** Colour this image belongs to, when the admin tagged it. */
  color?: string | null;
}

export interface ProductColor {
  name: string;
  hex: string;
  /** Index into `images` shown when this colour is selected. */
  imageIndex?: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  color: string;
  size: string;
  /** Units available to sell (stock minus reservations). */
  stock: number;
  stockStatus?: StockStatus;
  /** Effective unit price for this variant (may differ from the product price). */
  price?: number;
  compareAtPrice?: number;
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductShippingMethodInfo {
  code: string;
  name: string;
  description: string;
  price: number;
  freeShippingThreshold: number | null;
  minDays: number;
  maxDays: number;
  requiresAddress: boolean;
}

export interface ProductShippingInfo {
  freeShippingThreshold: number | null;
  currency: string;
  methods: ProductShippingMethodInfo[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  /** Brand display name. */
  brand: string;
  brandSlug?: string;
  department: Department;
  /** Category slug. */
  category: ProductCategory | (string & {});
  /** Category display name from the API. */
  categoryName?: string;
  sport: Sport;
  gender: Gender[];
  shortDescription: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviewCount: number;
  images: ProductImage[];
  colors: ProductColor[];
  sizes: string[];
  /** Empty for list/summary products (see `isSummary`) — load the detail for variant data. */
  variants: ProductVariant[];
  /** Total units available across all variants. */
  stock: number;
  stockStatus?: StockStatus;
  features: string[];
  specifications: ProductSpecification[];
  badge?: ProductBadge;
  isNew: boolean;
  isBestSeller: boolean;
  popularity: number;
  createdAt: string;
  sizeGuide: SizeGuideType;
  tags: string[];
  /** Legacy: product ids that pair with this item (mock data only). */
  completeTheLook?: string[];
  /** True when built from a list/summary response (no variants, description or specs). */
  isSummary?: boolean;
  /** Detail-only extras returned by `GET /products/:slug`. */
  ratingDistribution?: Record<1 | 2 | 3 | 4 | 5, number>;
  relatedProducts?: Product[];
  lookProducts?: Product[];
  shipping?: ProductShippingInfo;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  image: string;
  href: string;
}

/** Category from `GET /categories` (tree) and `GET /categories/:slug`. */
export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  parentId: string | null;
  productCount: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  children: CatalogCategory[];
  breadcrumb?: { id: string; name: string; slug: string }[];
}

export type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'rating' | 'popular';

export interface ProductQuery {
  collection?: string;
  q?: string;
  categories?: string[];
  brands?: string[];
  sizes?: string[];
  colors?: string[];
  genders?: Gender[];
  sports?: Sport[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly?: boolean;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  hex?: string;
}

export interface ProductFacets {
  categories: FacetOption[];
  brands: FacetOption[];
  sizes: FacetOption[];
  colors: FacetOption[];
  genders: FacetOption[];
  sports: FacetOption[];
  priceRange: { min: number; max: number };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ProductListResult extends Paginated<Product> {
  facets: ProductFacets;
}

export type StockState = 'in-stock' | 'low-stock' | 'out-of-stock';
