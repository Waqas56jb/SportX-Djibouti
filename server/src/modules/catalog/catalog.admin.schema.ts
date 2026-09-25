import { z } from 'zod';
import { paginationQuery } from '../../utils/pagination.js';
import { bool } from './catalog.schema.js';

/** Empty strings (unset admin filters) → undefined. */
const opt = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());
const upperEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase().replace(/-/g, '_') : v), z.enum(values));
const lowerEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(values));

export const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const GENDERS = ['MEN', 'WOMEN', 'KIDS', 'UNISEX'] as const;
export const SPORTS = ['football', 'basketball', 'running', 'training', 'lifestyle', 'multi-sport'] as const;
export const DEPARTMENTS = ['footwear', 'apparel', 'equipment', 'accessories'] as const;
export const IMAGE_ROLES = ['MAIN', 'GALLERY', 'HOVER'] as const;

const money = z.number().int().positive().max(1_000_000_000);
const productSku = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9-]{1,40}$/, 'SKU must be 2–41 letters, digits or dashes.'));
const variantSku = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9-]{1,60}$/, 'Variant SKU must be 2–61 letters, digits or dashes.'));
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Colour must be a hex value like #141414.');
const httpUrl = z.string().trim().url().max(2000).refine((u) => /^https?:\/\//i.test(u), 'Only http(s) URLs are allowed.');

export const variantInput = z.object({
  id: z.string().uuid().optional(),
  sku: variantSku.optional(),
  color: z.string().trim().min(1).max(40),
  colorHex: hex.optional(),
  size: z.string().trim().min(1).max(20),
  price: money.nullable().optional(),
  compareAtPrice: money.nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
  barcode: z.string().trim().max(64).nullable().optional(),
  weightGrams: z.number().int().min(0).max(1_000_000).nullable().optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().min(0).max(10_000).optional(),
});
export type VariantInput = z.infer<typeof variantInput>;
export const variantPatch = variantInput.omit({ id: true }).partial();
export type VariantPatch = z.infer<typeof variantPatch>;

export const imageInput = z.object({
  id: z.string().uuid().optional(),
  url: httpUrl,
  alt: z.string().trim().max(200).optional(),
  role: upperEnum([...IMAGE_ROLES] as [string, ...string[]]).optional(),
  color: z.string().trim().max(40).nullable().optional(),
  position: z.number().int().min(0).max(1000).optional(),
});
export type ImageInput = z.infer<typeof imageInput>;

const spec = z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().max(300) });

const productShape = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(120),
  sku: productSku,
  shortDescription: z.string().max(500),
  description: z.string().max(10_000),
  brandId: z.string().uuid(),
  categoryId: z.string().uuid(),
  department: lowerEnum([...DEPARTMENTS] as [string, ...string[]]),
  sport: lowerEnum([...SPORTS] as [string, ...string[]]),
  gender: upperEnum([...GENDERS] as [string, ...string[]]),
  type: z.string().trim().min(1).max(40),
  productType: z.string().trim().min(1).max(40),
  price: money,
  compareAtPrice: money.nullable(),
  costPrice: z.number().int().min(0).max(1_000_000_000).nullable(),
  taxRate: z.number().min(0).max(100).nullable(),
  status: upperEnum([...PRODUCT_STATUSES] as [string, ...string[]]),
  isFeatured: z.boolean(),
  featured: z.boolean(),
  isNew: z.boolean(),
  badge: z.enum(['new', 'bestseller', 'limited', 'exclusive']).nullable(),
  features: z.array(z.string().trim().min(1).max(300)).max(30),
  specifications: z.array(spec).max(50),
  specs: z.array(spec).max(50),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  sizeGuide: z.enum(['footwear', 'apparel', 'gloves', 'ball', 'none']),
  completeTheLook: z.array(z.string().uuid()).max(12),
  seo: z.object({ title: z.string().max(160).optional(), description: z.string().max(320).optional(), keywords: z.array(z.string().max(40)).max(30).optional() }),
  seoTitle: z.string().max(160).nullable(),
  seoDescription: z.string().max(320).nullable(),
  popularity: z.number().int().min(0).max(1_000_000),
  variants: z.array(variantInput).max(200),
  images: z.array(imageInput).max(30),
});

/** Canonical product input after alias resolution (admin sends `featured`, `specs`, `type`, `seo{}`, lowercase enums). */
export interface ProductInput {
  name?: string;
  slug?: string;
  sku?: string;
  shortDescription?: string;
  description?: string;
  brandId?: string;
  categoryId?: string;
  department?: string;
  sport?: string;
  gender?: string;
  productType?: string;
  price?: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  taxRate?: number | null;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isFeatured?: boolean;
  isNew?: boolean;
  badge?: string | null;
  features?: string[];
  specifications?: { label: string; value: string }[];
  tags?: string[];
  sizeGuide?: string;
  completeTheLook?: string[];
  seoTitle?: string | null;
  seoDescription?: string | null;
  popularity?: number;
  variants?: VariantInput[];
  images?: ImageInput[];
}

function canonical(v: z.infer<ReturnType<typeof productShape.partial>>): ProductInput {
  const { type, featured, specs, seo, ...rest } = v;
  const out: ProductInput = { ...(rest as ProductInput) };
  if (out.productType === undefined && type !== undefined) out.productType = type;
  if (out.isFeatured === undefined && featured !== undefined) out.isFeatured = featured;
  if (out.specifications === undefined && specs !== undefined) out.specifications = specs;
  if (seo) {
    if (out.seoTitle === undefined && seo.title !== undefined) out.seoTitle = seo.title || null;
    if (out.seoDescription === undefined && seo.description !== undefined) out.seoDescription = seo.description || null;
  }
  return out;
}

export const productCreateBody = productShape
  .partial()
  .required({ name: true, sku: true, brandId: true, categoryId: true, sport: true, price: true })
  .transform(canonical);
export const productUpdateBody = productShape.partial().transform(canonical);

export const statusBody = z.object({ status: upperEnum([...PRODUCT_STATUSES] as [string, ...string[]]) });

export const bulkBody = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(200),
    status: upperEnum([...PRODUCT_STATUSES] as [string, ...string[]]).optional(),
    categoryId: z.string().uuid().optional(),
  })
  .refine((b) => b.status !== undefined || b.categoryId !== undefined, 'Provide status or categoryId.');
export const bulkDeleteBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });

export const validateQuery = z.object({
  field: z.enum(['sku', 'slug']),
  value: z.string().trim().min(1).max(160),
  excludeId: opt(z.string().uuid()),
});

export const ADMIN_PRODUCT_SORTS = ['newest', 'oldest', 'price', 'stock', 'sales', 'name', 'updated'] as const;
export const adminProductListQuery = paginationQuery(100, 20).extend({
  search: opt(z.string().trim().max(120)),
  categoryId: opt(z.string().uuid()),
  brandId: opt(z.string().uuid()),
  status: opt(upperEnum([...PRODUCT_STATUSES] as [string, ...string[]])),
  stock: opt(upperEnum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'])),
  sport: opt(lowerEnum([...SPORTS] as [string, ...string[]])),
  gender: opt(upperEnum([...GENDERS] as [string, ...string[]])),
  minPrice: opt(z.coerce.number().int().min(0)),
  maxPrice: opt(z.coerce.number().int().min(0)),
  sort: opt(z.enum(ADMIN_PRODUCT_SORTS)),
  order: opt(z.enum(['asc', 'desc'])),
  includeDeleted: bool(),
});
export type AdminProductListQuery = z.infer<typeof adminProductListQuery>;

export const imageUploadFields = z.object({
  role: opt(upperEnum([...IMAGE_ROLES] as [string, ...string[]])),
  color: opt(z.string().trim().max(40)),
  alt: opt(z.string().trim().max(200)),
});
export const imagePatchBody = z.object({
  role: upperEnum([...IMAGE_ROLES] as [string, ...string[]]).optional(),
  alt: z.string().trim().max(200).optional(),
  color: z.string().trim().max(40).nullable().optional(),
  position: z.number().int().min(0).max(1000).optional(),
});
export const idsBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

// ───────────────────────── Categories & brands ─────────────────────────

const activeFromStatus = <T extends { status?: string; isActive?: boolean }>(v: T) =>
  v.isActive !== undefined ? v.isActive : v.status !== undefined ? v.status === 'active' : undefined;

const categoryShape = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(120),
  description: z.string().max(2000),
  imageUrl: httpUrl.nullable(),
  parentId: z.string().uuid().nullable(),
  status: lowerEnum(['active', 'inactive']),
  isActive: z.boolean(),
  position: z.number().int().min(0).max(100_000),
  sortOrder: z.number().int().min(0).max(100_000),
  seoTitle: z.string().max(160).nullable(),
  seoDescription: z.string().max(320).nullable(),
});
const canonicalCategory = (v: Partial<z.infer<typeof categoryShape>>) => {
  const { status: _s, position, sortOrder, slug, imageUrl, ...rest } = v;
  return {
    ...rest,
    slug: slug || undefined,
    imageUrl: imageUrl === '' ? null : imageUrl,
    isActive: activeFromStatus(v),
    sortOrder: sortOrder ?? position,
  };
};
export const categoryCreateBody = categoryShape.partial().required({ name: true }).transform((v) => ({ ...canonicalCategory(v), name: v.name }));
export const categoryUpdateBody = categoryShape.partial().transform(canonicalCategory);
export const activeStatusBody = z
  .object({ status: lowerEnum(['active', 'inactive']).optional(), isActive: z.boolean().optional() })
  .refine((v) => v.status !== undefined || v.isActive !== undefined, 'Provide status or isActive.')
  .transform((v) => ({ isActive: activeFromStatus(v)! }));

const brandShape = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(120),
  description: z.string().max(2000),
  logoUrl: httpUrl.nullable(),
  website: z.union([httpUrl, z.literal('')]).nullable(),
  status: lowerEnum(['active', 'inactive']),
  isActive: z.boolean(),
});
const canonicalBrand = (v: Partial<z.infer<typeof brandShape>>) => {
  const { status: _s, slug, ...rest } = v;
  return { ...rest, slug: slug || undefined, isActive: activeFromStatus(v) };
};
export const brandCreateBody = brandShape.partial().required({ name: true }).transform((v) => ({ ...canonicalBrand(v), name: v.name }));
export const brandUpdateBody = brandShape.partial().transform(canonicalBrand);
export const brandListQuery = z.object({ search: opt(z.string().trim().max(80)) });
