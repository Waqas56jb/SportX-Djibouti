import type { Product, ProductFilters, ProductImage, ProductInput, ProductListItem, ProductStatus } from '@/types';
import { uid } from '@/utils/id';
import { adminApi, ApiError, type Pagination, type Query } from './api';
import { isRemoteUrl, toImage, toProduct, toProductListItem, UUID_RE, type ApiImage, type ApiProduct, type ApiProductRow } from './catalogMappers';

export interface ProductPage {
  data: ProductListItem[];
  pagination: Pagination;
}

export interface SaveProductResult {
  product: ProductListItem;
  /** Uploads that failed (the product itself was saved). */
  failedUploads: string[];
  /** Set when the requested publish was refused (e.g. "Add a main image before publishing."). */
  publishError?: string;
}

const up = (v?: string) => (v ? v.toUpperCase() : undefined);

function listQuery(f: ProductFilters): Query {
  return {
    page: f.page ?? 1,
    limit: f.pageSize ?? 20,
    search: f.search,
    categoryId: f.categoryId,
    brandId: f.brandId,
    status: up(f.status || undefined),
    stock: up(f.stock || undefined),
    sport: f.sport || undefined,
    gender: up(f.gender || undefined),
    minPrice: f.minPrice,
    maxPrice: f.maxPrice,
    sort: f.sort,
    order: f.order,
  };
}

/** Frontend ProductInput → API body. Local (pending) images are excluded; they are uploaded after save. */
function toBody(input: ProductInput, status: ProductStatus, original?: Product) {
  const originalStock = new Map((original?.variants ?? []).map((v) => [v.id, v.stock]));
  return {
    name: input.name,
    slug: input.slug,
    sku: input.sku,
    brandId: input.brandId,
    categoryId: input.categoryId,
    sport: input.sport,
    gender: input.gender,
    type: input.type,
    status: status.toUpperCase(),
    price: input.price,
    compareAtPrice: input.compareAtPrice ?? null,
    costPrice: input.costPrice ?? null,
    taxRate: input.taxRate ?? null,
    shortDescription: input.shortDescription,
    description: input.description,
    specs: input.specs,
    tags: input.tags,
    featured: input.featured,
    seo: { title: input.seo.title, description: input.seo.description },
    variants: input.variants.map((v, position) => {
      const known = UUID_RE.test(v.id) && (!original || originalStock.has(v.id));
      const price = typeof v.price === 'number' && v.price > 0 ? v.price : null;
      return {
        ...(known ? { id: v.id } : {}),
        sku: v.sku || undefined,
        color: v.color,
        colorHex: /^#[0-9a-f]{6}$/i.test(v.colorHex) ? v.colorHex : undefined,
        size: v.size,
        price,
        // Only send stock when it changed, so a concurrent adjustment elsewhere is not overwritten.
        ...(known && originalStock.get(v.id) === v.stock ? {} : { stock: v.stock }),
        lowStockThreshold: v.lowStockThreshold,
        barcode: v.barcode || null,
        position,
      };
    }),
    images: input.images
      .filter((i) => !i.file && isRemoteUrl(i.url))
      .map((i) => ({ ...(UUID_RE.test(i.id) ? { id: i.id } : {}), url: i.url, alt: i.alt, role: i.role.toUpperCase(), color: i.color ?? null, position: i.position })),
  };
}

async function fetchAll(filters: ProductFilters): Promise<ProductListItem[]> {
  const out: ProductListItem[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await adminApi.page<ApiProductRow>('/products', listQuery({ ...filters, page, pageSize: 100 }));
    out.push(...res.data.map(toProductListItem));
    if (!res.pagination.hasNext) break;
  }
  return out;
}

export const productService = {
  /** GET /admin/products — one server page (use for the products table). */
  async listProducts(filters: ProductFilters = {}, signal?: AbortSignal): Promise<ProductPage> {
    const res = await adminApi.page<ApiProductRow>('/products', listQuery(filters), signal);
    return { data: res.data.map(toProductListItem), pagination: res.pagination };
  },

  /**
   * Every product matching the filters (walks the pages). For pickers / lookups only —
   * list screens must use `listProducts` with server pagination.
   */
  async getProducts(filters: ProductFilters = {}): Promise<ProductListItem[]> {
    return fetchAll(filters);
  },

  /** GET /admin/products/:id — full product with images and variants. */
  async getProduct(id: string): Promise<ProductListItem> {
    return toProduct(await adminApi.get<ApiProduct>(`/products/${id}`));
  },

  /** POST /admin/products (then uploads queued images and applies the requested status). */
  async createProduct(input: ProductInput): Promise<ProductListItem> {
    return (await productService.saveProduct(undefined, input)).product;
  },

  /** PATCH /admin/products/:id (then uploads queued images and applies the requested status). */
  async updateProduct(id: string, input: ProductInput, original?: Product): Promise<ProductListItem> {
    return (await productService.saveProduct(id, input, original)).product;
  },

  /**
   * Full save flow for the product form:
   * 1. create/update the product with its variants and already-uploaded images;
   * 2. upload images picked locally (multipart POST /products/:id/images) with their role;
   * 3. restore the gallery order (PUT /products/:id/images/order);
   * 4. publish last when publishing depends on a freshly uploaded main image.
   */
  async saveProduct(id: string | undefined, input: ProductInput, original?: Product): Promise<SaveProductResult> {
    const target = input.status;
    const pending = input.images.filter((i) => i.file);
    const remote = input.images.filter((i) => !i.file && isRemoteUrl(i.url));
    // Publishing needs a main image server-side: defer it until queued uploads are in.
    const deferPublish = target === 'published' && pending.length > 0;
    const stayPublished = Boolean(id) && original?.status === 'published' && remote.length > 0;
    const firstStatus: ProductStatus = deferPublish && !stayPublished ? 'draft' : target;

    const body = toBody(input, firstStatus, original);
    const saved = id ? await adminApi.patch<ApiProduct>(`/products/${id}`, body) : await adminApi.post<ApiProduct>('/products', body);
    const productId = saved.id;
    const failedUploads: string[] = [];

    if (pending.length) {
      const idMap = new Map<string, string>();
      for (const img of pending) {
        try {
          const created = await adminApi.upload<ApiImage>(`/products/${productId}/images`, img.file!, { role: img.role.toUpperCase(), alt: img.alt || input.name });
          idMap.set(img.id, created.id);
        } catch (e) {
          failedUploads.push(`${img.file!.name}: ${e instanceof Error ? e.message : 'upload failed'}`);
        }
      }
      // Re-apply the order chosen in the form (main → hover → gallery order).
      const current = await adminApi.get<ApiProduct>(`/products/${productId}`);
      const serverIds = new Set(current.images.map((i) => i.id));
      const desired = [...input.images]
        .sort((a, b) => a.position - b.position)
        .map((i) => (i.file ? idMap.get(i.id) : i.id))
        .filter((x): x is string => Boolean(x && serverIds.has(x)));
      const rest = current.images.map((i) => i.id).filter((x) => !desired.includes(x));
      const order = [...desired, ...rest];
      if (order.length > 1) await adminApi.put(`/products/${productId}/images/order`, { ids: order }).catch(() => undefined);
    }

    let publishError: string | undefined;
    if (firstStatus !== target) {
      try {
        await adminApi.patch(`/products/${productId}/status`, { status: 'PUBLISHED' });
      } catch (e) {
        publishError = e instanceof Error ? e.message : 'Could not publish.';
      }
    }
    const product = await productService.getProduct(productId);
    return { product, failedUploads, publishError };
  },

  /** DELETE /admin/products/:id → hard delete, or archive when the product has order history. */
  async deleteProduct(id: string): Promise<{ result: 'DELETED' | 'ARCHIVED' }> {
    const out = await adminApi.delete<{ result: 'DELETED' | 'ARCHIVED' }>(`/products/${id}`);
    return { result: out.result };
  },

  /** POST /admin/products/:id/duplicate — the copy is a draft with stock 0. */
  async duplicateProduct(id: string): Promise<ProductListItem> {
    return toProduct(await adminApi.post<ApiProduct>(`/products/${id}/duplicate`));
  },

  /** PATCH /admin/products/:id/status — publishing is validated server-side (main image + active variant). */
  async setStatus(id: string, status: ProductStatus): Promise<ProductListItem> {
    return toProduct(await adminApi.patch<ApiProduct>(`/products/${id}/status`, { status: status.toUpperCase() }));
  },

  /** PATCH /admin/products/bulk { ids, status } */
  async bulkUpdateStatus(ids: string[], status: ProductStatus): Promise<void> {
    if (ids.length === 1) {
      await productService.setStatus(ids[0], status);
      return;
    }
    await adminApi.patch('/products/bulk', { ids, status: status.toUpperCase() });
  },

  /** PATCH /admin/products/bulk { ids, categoryId } */
  async bulkChangeCategory(ids: string[], categoryId: string): Promise<void> {
    await adminApi.patch('/products/bulk', { ids, categoryId });
  },

  /** POST /admin/products/bulk-delete → which ids were deleted vs archived (order history). */
  async bulkDelete(ids: string[]): Promise<{ deleted: string[]; archived: string[] }> {
    return adminApi.post<{ deleted: string[]; archived: string[] }>('/products/bulk-delete', { ids });
  },

  /** GET /admin/products/validate?field=&value=&excludeId= */
  async isUnique(field: 'sku' | 'slug', value: string, excludeId?: string): Promise<boolean> {
    const r = await adminApi.get<{ unique: boolean }>('/products/validate', { field, value, excludeId });
    return r.unique;
  },

  /**
   * Stages an image picked in the product form: returns a local preview with the file attached.
   * The file is uploaded to the API when the product is saved (see `saveProduct`).
   */
  async uploadImage(file: File, role: ProductImage['role'] = 'gallery'): Promise<ProductImage> {
    if (!/^image\/(jpeg|png|webp|avif)$/i.test(file.type)) throw new ApiError('Only JPEG, PNG, WebP or AVIF images are allowed.', 415, 'UNSUPPORTED_MEDIA_TYPE');
    return { id: uid('img'), url: URL.createObjectURL(file), alt: file.name.replace(/\.[^.]+$/, ''), role, position: 0, file };
  },

  // ─── Image endpoints for saved products (detail page) ───

  /** POST /admin/products/:id/images (multipart). */
  async addImage(productId: string, file: File, role?: ProductImage['role'], alt?: string): Promise<ProductImage> {
    const fields: Record<string, string> = {};
    if (role) fields.role = role.toUpperCase();
    if (alt) fields.alt = alt;
    return toImage(await adminApi.upload<ApiImage>(`/products/${productId}/images`, file, fields));
  },

  /** PATCH /admin/products/:id/images/:imageId */
  async updateImage(productId: string, imageId: string, patch: { role?: ProductImage['role']; alt?: string }): Promise<ProductImage> {
    return toImage(await adminApi.patch<ApiImage>(`/products/${productId}/images/${imageId}`, { ...patch, role: patch.role?.toUpperCase() }));
  },

  /** PUT /admin/products/:id/images/order — every image id exactly once. */
  async reorderImages(productId: string, ids: string[]): Promise<ProductImage[]> {
    return (await adminApi.put<ApiImage[]>(`/products/${productId}/images/order`, { ids })).map(toImage);
  },

  /** DELETE /admin/products/:id/images/:imageId */
  async deleteImage(productId: string, imageId: string): Promise<void> {
    await adminApi.delete(`/products/${productId}/images/${imageId}`);
  },
};
