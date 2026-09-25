import type { Gender, Product, ProductImage, ProductInput, ProductStatus, ProductType, ProductVariant, Sport } from '@/types';
import { colorByName } from '@/constants/catalog';
import { isSlug } from '@/utils/validation';
import { uid } from '@/utils/id';

export interface SpecRow {
  id: string;
  label: string;
  value: string;
}

/** Editable form state. Numbers may be '' while the field is empty. */
export interface ProductDraft {
  name: string;
  slug: string;
  sku: string;
  brandId: string;
  categoryId: string;
  sport: Sport | '';
  gender: Gender | '';
  type: ProductType | '';
  status: ProductStatus;
  price: number | '';
  compareAtPrice: number | '';
  costPrice: number | '';
  taxRate: number | '';
  shortDescription: string;
  description: string;
  specs: SpecRow[];
  images: ProductImage[];
  variants: ProductVariant[];
  seo: { title: string; description: string; keywords: string[] };
  tags: string[];
  featured: boolean;
  publishedAt?: string;
}

export type SetDraft = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => void;
export type FormErrors = Record<string, string>;

export const SECTIONS = [
  { id: 'basic', label: 'Basic information' },
  { id: 'media', label: 'Media' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'variants', label: 'Variants' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'description', label: 'Description' },
  { id: 'specs', label: 'Specifications' },
  { id: 'seo', label: 'SEO' },
  { id: 'publishing', label: 'Publishing' },
] as const;
export type SectionId = (typeof SECTIONS)[number]['id'];

export const emptyDraft = (): ProductDraft => ({
  name: '',
  slug: '',
  sku: '',
  brandId: '',
  categoryId: '',
  sport: '',
  gender: '',
  type: '',
  status: 'draft',
  price: '',
  compareAtPrice: '',
  costPrice: '',
  taxRate: 0,
  shortDescription: '',
  description: '',
  specs: [],
  images: [],
  variants: [],
  seo: { title: '', description: '', keywords: [] },
  tags: [],
  featured: false,
});

export function fromProduct(p: Product): ProductDraft {
  return {
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    brandId: p.brandId,
    categoryId: p.categoryId,
    sport: p.sport,
    gender: p.gender,
    type: p.type,
    status: p.status,
    price: p.price,
    compareAtPrice: p.compareAtPrice ?? '',
    costPrice: p.costPrice ?? '',
    taxRate: p.taxRate,
    shortDescription: p.shortDescription,
    description: p.description,
    specs: p.specs.map((s) => ({ id: uid('spec'), ...s })),
    images: [...p.images].sort((a, b) => a.position - b.position),
    variants: p.variants.map((v) => ({ ...v })),
    seo: { ...p.seo, keywords: [...p.seo.keywords] },
    tags: [...p.tags],
    featured: p.featured,
    publishedAt: p.publishedAt,
  };
}

const num = (v: number | '') => (v === '' ? undefined : v);

/** Images ordered main → hover → gallery with positions re-numbered. */
export function orderedImages(images: ProductImage[]): ProductImage[] {
  const rank = { main: 0, hover: 1, gallery: 2 } as const;
  return images
    .map((img, i) => ({ img, i }))
    .sort((a, b) => rank[a.img.role] - rank[b.img.role] || a.i - b.i)
    .map(({ img }, position) => ({ ...img, position }));
}

export function toInput(d: ProductDraft, status: ProductStatus): ProductInput {
  return {
    name: d.name.trim(),
    slug: d.slug.trim(),
    sku: d.sku.trim().toUpperCase(),
    brandId: d.brandId,
    categoryId: d.categoryId,
    sport: d.sport as Sport,
    gender: d.gender as Gender,
    type: d.type as ProductType,
    status,
    price: d.price === '' ? 0 : d.price,
    compareAtPrice: num(d.compareAtPrice),
    costPrice: num(d.costPrice),
    taxRate: d.taxRate === '' ? 0 : d.taxRate,
    shortDescription: d.shortDescription.trim(),
    description: d.description.trim(),
    specs: d.specs.filter((s) => s.label.trim() && s.value.trim()).map((s) => ({ label: s.label.trim(), value: s.value.trim() })),
    images: orderedImages(d.images),
    variants: d.variants.map((v) => ({ ...v, sku: v.sku.trim().toUpperCase(), barcode: v.barcode?.trim() || undefined })),
    seo: { title: d.seo.title.trim(), description: d.seo.description.trim(), keywords: d.seo.keywords },
    tags: d.tags,
    featured: d.featured,
    publishedAt: d.publishedAt,
  };
}

export const colorCode = (name: string) => colorByName(name)?.code ?? name.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase();
export const sizeCode = (size: string) => size.replace(/\s*\(.*\)/, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
export const variantSku = (productSku: string, color: string, size: string) => [productSku.trim().toUpperCase() || 'SKU', colorCode(color), sizeCode(size)].join('-');

// ─── Validation ─────────────────────────────────────────────────────────────
/** Synchronous validation. Uniqueness errors are merged in by the page. */
export function validate(d: ProductDraft, status: ProductStatus): FormErrors {
  const e: FormErrors = {};
  if (!d.name.trim()) e.name = 'Product name is required.';
  if (!d.slug.trim()) e.slug = 'Slug is required.';
  else if (!isSlug(d.slug)) e.slug = 'Use lowercase letters, numbers and single hyphens only.';
  if (!d.sku.trim()) e.sku = 'SKU is required.';
  else if (!/^[A-Za-z0-9-]+$/.test(d.sku.trim())) e.sku = 'SKU can contain letters, numbers and hyphens only.';
  if (!d.brandId) e.brandId = 'Select a brand.';
  if (!d.categoryId) e.categoryId = 'Select a category.';
  if (!d.sport) e.sport = 'Select a sport.';
  if (!d.gender) e.gender = 'Select a gender.';
  if (!d.type) e.type = 'Select a product type.';

  if (d.price === '' || d.price <= 0) e.price = 'Price must be greater than 0.';
  if (d.compareAtPrice !== '' && d.price !== '' && d.compareAtPrice <= d.price) e.compareAtPrice = 'Compare-at price must be higher than the price.';
  if (d.costPrice !== '' && d.costPrice < 0) e.costPrice = 'Cost price cannot be negative.';
  if (d.taxRate !== '' && (d.taxRate < 0 || d.taxRate > 100)) e.taxRate = 'Tax must be between 0 and 100%.';

  if (d.variants.length === 0) e.variants = 'Add at least one variant.';
  const seen = new Map<string, number>();
  d.variants.forEach((v) => seen.set(v.sku.trim().toUpperCase(), (seen.get(v.sku.trim().toUpperCase()) ?? 0) + 1));
  for (const v of d.variants) {
    if (!v.sku.trim()) e[`variant.${v.id}.sku`] = 'SKU required';
    else if ((seen.get(v.sku.trim().toUpperCase()) ?? 0) > 1) e[`variant.${v.id}.sku`] = 'Duplicate SKU';
    if (!Number.isInteger(v.stock) || v.stock < 0) e[`variant.${v.id}.stock`] = 'Invalid stock';
    if (v.price !== undefined && v.price <= 0) e[`variant.${v.id}.price`] = 'Must be > 0';
  }
  if (!e.variants && Object.keys(e).some((k) => k.startsWith('variant.'))) e.variants = 'Fix the highlighted variant fields.';

  if (d.shortDescription.length > 160) e.shortDescription = 'Keep the short description under 160 characters.';
  if (d.specs.some((s) => (s.label.trim() && !s.value.trim()) || (!s.label.trim() && s.value.trim()))) e.specs = 'Each specification needs both a name and a value.';

  if (status === 'published') {
    if (!d.images.some((i) => i.role === 'main')) e.images = 'A main image is required to publish.';
    if (!d.shortDescription.trim()) e.shortDescription = 'A short description is required to publish.';
  }
  return e;
}

const SECTION_OF: Record<string, SectionId> = {
  name: 'basic',
  slug: 'basic',
  sku: 'basic',
  brandId: 'basic',
  categoryId: 'basic',
  sport: 'basic',
  gender: 'basic',
  type: 'basic',
  images: 'media',
  price: 'pricing',
  compareAtPrice: 'pricing',
  costPrice: 'pricing',
  taxRate: 'pricing',
  variants: 'variants',
  shortDescription: 'description',
  description: 'description',
  specs: 'specs',
};

export const sectionOfError = (key: string): SectionId => (key.startsWith('variant.') ? 'variants' : key.startsWith('seo') ? 'seo' : SECTION_OF[key] ?? 'basic');

/** Completion state for the section rail. */
export function sectionCompletion(d: ProductDraft): Record<SectionId, boolean> {
  return {
    basic: Boolean(d.name && d.slug && d.sku && d.brandId && d.categoryId && d.sport && d.gender && d.type),
    media: d.images.some((i) => i.role === 'main'),
    pricing: d.price !== '' && d.price > 0,
    variants: d.variants.length > 0,
    inventory: d.variants.length > 0 && d.variants.some((v) => v.stock > 0),
    description: Boolean(d.shortDescription.trim() && d.description.trim()),
    specs: d.specs.some((s) => s.label.trim() && s.value.trim()),
    seo: Boolean(d.seo.title.trim() && d.seo.description.trim()),
    publishing: d.status === 'published' || d.tags.length > 0,
  };
}
