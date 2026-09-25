import type { ID, ISODate } from './common';

export type ProductStatus = 'draft' | 'published' | 'archived';
export type Gender = 'men' | 'women' | 'kids' | 'unisex';
export type Sport = 'football' | 'basketball' | 'running' | 'training' | 'lifestyle' | 'multi-sport';
export type ProductType =
  | 'footwear'
  | 'apparel'
  | 'jersey'
  | 'shorts'
  | 'tracksuit'
  | 'bag'
  | 'socks'
  | 'gloves'
  | 'ball'
  | 'equipment';

export interface ProductImage {
  id: ID;
  url: string;
  alt: string;
  role: 'main' | 'gallery' | 'hover';
  position: number;
  /** Storage key for future S3 / Supabase Storage objects. */
  storageKey?: string;
}

export interface ProductVariant {
  id: ID;
  productId: ID;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  /** Overrides product price when set. */
  price?: number;
  stock: number;
  reserved: number;
  lowStockThreshold: number;
  barcode?: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductSeo {
  title: string;
  description: string;
  keywords: string[];
}

export interface Product {
  id: ID;
  name: string;
  slug: string;
  sku: string;
  brandId: ID;
  categoryId: ID;
  sport: Sport;
  gender: Gender;
  type: ProductType;
  status: ProductStatus;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  /** Percentage, e.g. 10 = 10%. */
  taxRate: number;
  shortDescription: string;
  description: string;
  specs: ProductSpec[];
  images: ProductImage[];
  variants: ProductVariant[];
  seo: ProductSeo;
  tags: string[];
  featured: boolean;
  unitsSold: number;
  revenue: number;
  views: number;
  rating: number;
  reviewCount: number;
  publishedAt?: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

/** Row shape returned by list endpoints (joins resolved server-side). */
export interface ProductListItem extends Product {
  brandName: string;
  categoryName: string;
  totalStock: number;
  stockStatus: StockStatus;
}

export type ProductInput = Omit<
  Product,
  'id' | 'createdAt' | 'updatedAt' | 'unitsSold' | 'revenue' | 'views' | 'rating' | 'reviewCount'
>;

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus | '';
  stock?: StockStatus | '';
  sport?: Sport | '';
  gender?: Gender | '';
  minPrice?: number;
  maxPrice?: number;
}

export interface Category {
  id: ID;
  name: string;
  slug: string;
  description: string;
  imageUrl?: string;
  parentId: ID | null;
  status: 'active' | 'inactive';
  position: number;
  productCount: number;
  seoTitle: string;
  seoDescription: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type CategoryInput = Omit<Category, 'id' | 'productCount' | 'createdAt' | 'updatedAt'>;

export interface Brand {
  id: ID;
  name: string;
  slug: string;
  logoUrl?: string;
  description: string;
  website: string;
  status: 'active' | 'inactive';
  productCount: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type BrandInput = Omit<Brand, 'id' | 'productCount' | 'createdAt' | 'updatedAt'>;
