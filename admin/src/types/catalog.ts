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
  /** Storage path of an uploaded object (null for URL-based images). */
  storageKey?: string;
  /** Colour the image belongs to (optional, used by the storefront gallery). */
  color?: string;
  /** Local file waiting to be uploaded on save (object-URL preview in `url`). */
  file?: File;
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
  /** Main image URL (list rows do not carry the full image set). */
  image?: string;
  /** Variant count (list rows do not carry the variants themselves). */
  variantsCount: number;
  /** Σ (stock − reserved) across variants. */
  available?: number;
}

export type ProductSortKey = 'newest' | 'oldest' | 'price' | 'stock' | 'sales' | 'name' | 'updated';

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
  page?: number;
  pageSize?: number;
  sort?: ProductSortKey;
  order?: 'asc' | 'desc';
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
  /** Depth in the tree (0 = root). */
  depth?: number;
  /** Products in this category and all of its descendants. */
  totalProductCount?: number;
  childrenCount?: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type CategoryInput = Omit<Category, 'id' | 'productCount' | 'createdAt' | 'updatedAt' | 'depth' | 'totalProductCount' | 'childrenCount'> & {
  /** New image picked in the form — uploaded after the category is saved. */
  imageFile?: File;
};

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

export type BrandInput = Omit<Brand, 'id' | 'productCount' | 'createdAt' | 'updatedAt'> & {
  /** New logo picked in the form — uploaded after the brand is saved. */
  logoFile?: File;
};
