import type { Brand, BrandInput } from '@/types';
import { appConfig } from '@/constants/config';
import { uid } from '@/utils/id';
import { api, ApiError } from './http';
import { audit, db, delay, NotFoundError, now } from './mock/db';

const withCounts = (b: Brand): Brand => ({ ...b, productCount: db.products.filter((p) => p.brandId === b.id).length });

export const brandService = {
  /** GET /brands */
  async getBrands(): Promise<Brand[]> {
    if (!appConfig.useMocks) return api.get<Brand[]>('/brands');
    return delay(db.brands.map(withCounts).sort((a, b) => a.name.localeCompare(b.name)));
  },

  /** POST /brands */
  async createBrand(input: BrandInput): Promise<Brand> {
    if (!appConfig.useMocks) return api.post<Brand>('/brands', input);
    if (db.brands.some((b) => b.slug === input.slug)) throw new ApiError('A brand with this slug already exists.', 409, 'slug_taken');
    const brand: Brand = { ...input, id: uid('brd'), productCount: 0, createdAt: now(), updatedAt: now() };
    db.brands.push(brand);
    audit('Brand created', 'Catalog', brand.name, '/brands');
    return delay(brand);
  },

  /** PUT /brands/:id */
  async updateBrand(id: string, input: BrandInput): Promise<Brand> {
    if (!appConfig.useMocks) return api.put<Brand>(`/brands/${id}`, input);
    const brand = db.brands.find((b) => b.id === id);
    if (!brand) throw new NotFoundError('Brand');
    Object.assign(brand, input, { updatedAt: now() });
    audit('Brand updated', 'Catalog', brand.name, '/brands');
    return delay(withCounts(brand));
  },

  /** PATCH /brands/:id/status */
  async setStatus(id: string, status: Brand['status']): Promise<Brand> {
    if (!appConfig.useMocks) return api.patch<Brand>(`/brands/${id}/status`, { status });
    const brand = db.brands.find((b) => b.id === id);
    if (!brand) throw new NotFoundError('Brand');
    brand.status = status;
    brand.updatedAt = now();
    audit(status === 'active' ? 'Brand enabled' : 'Brand disabled', 'Catalog', brand.name, '/brands');
    return delay(withCounts(brand));
  },

  /** DELETE /brands/:id */
  async deleteBrand(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.delete(`/brands/${id}`);
    const brand = db.brands.find((b) => b.id === id);
    if (!brand) throw new NotFoundError('Brand');
    if (db.products.some((p) => p.brandId === id)) throw new ApiError('This brand still has products. Reassign or delete them first.', 409, 'has_products');
    db.brands = db.brands.filter((b) => b.id !== id);
    audit('Brand deleted', 'Catalog', brand.name);
    await delay(null);
  },
};
