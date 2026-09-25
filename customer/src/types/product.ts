export type Gender = 'men' | 'women' | 'kids' | 'unisex';

export type Sport = 'football' | 'basketball' | 'running' | 'training' | 'lifestyle';

export type Department = 'footwear' | 'apparel' | 'equipment' | 'accessories';

export type ProductCategory =
  | 'football-boots'
  | 'basketball-shoes'
  | 'running-shoes'
  | 'training-shoes'
  | 'lifestyle-shoes'
  | 'jerseys'
  | 'tees'
  | 'shorts'
  | 'tracksuits'
  | 'hoodies'
  | 'jackets'
  | 'leggings'
  | 'sports-bras'
  | 'balls'
  | 'gloves'
  | 'socks'
  | 'caps'
  | 'bags'
  | 'gym-equipment'
  | 'wearables';

export type ProductBadge = 'new' | 'bestseller' | 'limited' | 'exclusive';

export type SizeGuideType = 'footwear' | 'apparel' | 'gloves' | 'ball' | 'none';

export interface ProductImage {
  url: string;
  alt: string;
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
  stock: number;
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  department: Department;
  category: ProductCategory;
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
  variants: ProductVariant[];
  /** Total units across all variants. */
  stock: number;
  features: string[];
  specifications: ProductSpecification[];
  badge?: ProductBadge;
  isNew: boolean;
  isBestSeller: boolean;
  popularity: number;
  createdAt: string;
  sizeGuide: SizeGuideType;
  tags: string[];
  /** Product ids that pair with this item for "Complete the look". */
  completeTheLook?: string[];
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  image: string;
  href: string;
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
