import type { Product, ProductFilters, ProductImage, ProductInput, ProductListItem, ProductStatus } from '@/types';
import { appConfig } from '@/constants/config';
import { productStockStatus, totalStock } from '@/utils/stock';
import { uid } from '@/utils/id';
import { api } from './http';
import { audit, db, delay, matches, NotFoundError, now } from './mock/db';

function toListItem(p: Product): ProductListItem {
  return {
    ...p,
    brandName: db.brands.find((b) => b.id === p.brandId)?.name ?? '—',
    categoryName: db.categories.find((c) => c.id === p.categoryId)?.name ?? '—',
    totalStock: totalStock(p.variants),
    stockStatus: productStockStatus(p.variants),
  };
}

function inCategory(p: Product, categoryId: string) {
  if (p.categoryId === categoryId) return true;
  const cat = db.categories.find((c) => c.id === p.categoryId);
  if (cat?.parentId === categoryId) return true;
  const target = db.categories.find((c) => c.id === categoryId);
  if (target && ['men', 'women', 'kids'].includes(target.slug)) return p.gender === target.slug || (p.gender === 'unisex' && target.slug !== 'kids');
  return false;
}

export const productService = {
  /** GET /products */
  async getProducts(filters: ProductFilters = {}): Promise<ProductListItem[]> {
    if (!appConfig.useMocks) return api.get<ProductListItem[]>('/products', { ...filters });
    const list = db.products
      .map(toListItem)
      .filter((p) => matches([p.name, p.sku, p.brandName, p.categoryName, ...p.variants.map((v) => v.sku)], filters.search))
      .filter((p) => !filters.categoryId || inCategory(p, filters.categoryId))
      .filter((p) => !filters.brandId || p.brandId === filters.brandId)
      .filter((p) => !filters.status || p.status === filters.status)
      .filter((p) => !filters.stock || p.stockStatus === filters.stock)
      .filter((p) => !filters.sport || p.sport === filters.sport)
      .filter((p) => !filters.gender || p.gender === filters.gender)
      .filter((p) => filters.minPrice === undefined || p.price >= filters.minPrice)
      .filter((p) => filters.maxPrice === undefined || p.price <= filters.maxPrice)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return delay(list);
  },

  /** GET /products/:id */
  async getProduct(id: string): Promise<ProductListItem> {
    if (!appConfig.useMocks) return api.get<ProductListItem>(`/products/${id}`);
    const p = db.products.find((x) => x.id === id);
    if (!p) throw new NotFoundError('Product');
    return delay(toListItem(p));
  },

  /** POST /products */
  async createProduct(input: ProductInput): Promise<Product> {
    if (!appConfig.useMocks) return api.post<Product>('/products', input);
    const id = uid('prd');
    const product: Product = {
      ...input,
      id,
      variants: input.variants.map((v) => ({ ...v, productId: id })),
      unitsSold: 0,
      revenue: 0,
      views: 0,
      rating: 0,
      reviewCount: 0,
      publishedAt: input.status === 'published' ? now() : undefined,
      createdAt: now(),
      updatedAt: now(),
    };
    db.products.unshift(product);
    audit('Product created', 'Products', product.name, `/products/${id}`);
    return delay(product, 700);
  },

  /** PUT /products/:id */
  async updateProduct(id: string, input: ProductInput): Promise<Product> {
    if (!appConfig.useMocks) return api.put<Product>(`/products/${id}`, input);
    const idx = db.products.findIndex((x) => x.id === id);
    if (idx < 0) throw new NotFoundError('Product');
    const prev = db.products[idx];
    const next: Product = {
      ...prev,
      ...input,
      id,
      publishedAt: input.status === 'published' ? prev.publishedAt ?? now() : prev.publishedAt,
      updatedAt: now(),
    };
    db.products[idx] = next;
    audit('Product updated', 'Products', next.name, `/products/${id}`);
    return delay(next, 600);
  },

  /** DELETE /products/:id */
  async deleteProduct(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.delete(`/products/${id}`);
    const p = db.products.find((x) => x.id === id);
    if (!p) throw new NotFoundError('Product');
    db.products = db.products.filter((x) => x.id !== id);
    audit('Product deleted', 'Products', p.name);
    await delay(null);
  },

  /** POST /products/:id/duplicate */
  async duplicateProduct(id: string): Promise<Product> {
    if (!appConfig.useMocks) return api.post<Product>(`/products/${id}/duplicate`);
    const src = db.products.find((x) => x.id === id);
    if (!src) throw new NotFoundError('Product');
    const newId = uid('prd');
    const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
    const copy: Product = {
      ...structuredClone(src),
      id: newId,
      name: `${src.name} (Copy)`,
      slug: `${src.slug}-copy-${suffix.toLowerCase()}`,
      sku: `${src.sku}-C${suffix}`,
      status: 'draft',
      variants: src.variants.map((v) => ({ ...v, id: uid('var'), productId: newId, sku: `${v.sku}-C${suffix}`, stock: 0, reserved: 0 })),
      unitsSold: 0,
      revenue: 0,
      views: 0,
      reviewCount: 0,
      rating: 0,
      publishedAt: undefined,
      createdAt: now(),
      updatedAt: now(),
    };
    db.products.unshift(copy);
    audit('Product duplicated', 'Products', copy.name, `/products/${newId}`);
    return delay(copy);
  },

  /** PATCH /products/bulk { ids, status } */
  async bulkUpdateStatus(ids: string[], status: ProductStatus): Promise<void> {
    if (!appConfig.useMocks) return api.patch('/products/bulk', { ids, status });
    for (const p of db.products) if (ids.includes(p.id)) {
      p.status = status;
      p.updatedAt = now();
      if (status === 'published' && !p.publishedAt) p.publishedAt = now();
    }
    audit(`Products ${status}`, 'Products', `${ids.length} product(s)`);
    await delay(null);
  },

  /** PATCH /products/bulk { ids, categoryId } */
  async bulkChangeCategory(ids: string[], categoryId: string): Promise<void> {
    if (!appConfig.useMocks) return api.patch('/products/bulk', { ids, categoryId });
    for (const p of db.products) if (ids.includes(p.id)) {
      p.categoryId = categoryId;
      p.updatedAt = now();
    }
    audit('Products re-categorised', 'Products', `${ids.length} product(s)`);
    await delay(null);
  },

  /** DELETE /products/bulk */
  async bulkDelete(ids: string[]): Promise<void> {
    if (!appConfig.useMocks) return api.post('/products/bulk-delete', { ids });
    db.products = db.products.filter((p) => !ids.includes(p.id));
    audit('Products deleted', 'Products', `${ids.length} product(s)`);
    await delay(null);
  },

  /** Checks SKU / slug uniqueness. GET /products/validate */
  async isUnique(field: 'sku' | 'slug', value: string, excludeId?: string): Promise<boolean> {
    if (!appConfig.useMocks) return api.get<{ unique: boolean }>('/products/validate', { field, value, excludeId }).then((r) => r.unique);
    const v = value.trim().toLowerCase();
    return !db.products.some((p) => p.id !== excludeId && p[field].toLowerCase() === v);
  },

  /**
   * Upload a product image. Frontend phase: returns a local object URL.
   * Backend phase: request a presigned URL (POST /uploads/presign), PUT the file to storage,
   * then return the resulting public URL + storageKey.
   */
  async uploadImage(file: File, role: ProductImage['role'] = 'gallery'): Promise<ProductImage> {
    await delay(null, 400);
    return {
      id: uid('img'),
      url: URL.createObjectURL(file),
      alt: file.name.replace(/\.[^.]+$/, ''),
      role,
      position: 0,
      storageKey: `products/pending/${file.name}`,
    };
  },
};
