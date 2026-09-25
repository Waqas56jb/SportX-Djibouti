import type { Brand, BrandInput } from '@/types';
import { adminApi } from './api';
import { isRemoteUrl, toBrand, type ApiBrand } from './catalogMappers';

function toBody(input: Partial<BrandInput>) {
  const { logoFile: _f, logoUrl, website, ...rest } = input;
  return {
    ...rest,
    website: website?.trim() ? website.trim() : null,
    ...(logoUrl === undefined || logoUrl === '' ? { logoUrl: null } : isRemoteUrl(logoUrl) ? { logoUrl } : {}),
  };
}

async function withLogo(saved: ApiBrand, file?: File): Promise<Brand> {
  if (!file) return toBrand(saved);
  return toBrand(await adminApi.upload<ApiBrand>(`/brands/${saved.id}/logo`, file));
}

export const brandService = {
  /** GET /admin/brands */
  async getBrands(search?: string): Promise<Brand[]> {
    const list = await adminApi.get<ApiBrand[]>('/brands', { search });
    return list.map(toBrand).sort((a, b) => a.name.localeCompare(b.name));
  },

  /** POST /admin/brands (+ POST /:id/logo when a logo was picked). */
  async createBrand(input: BrandInput): Promise<Brand> {
    const saved = await adminApi.post<ApiBrand>('/brands', toBody(input));
    return withLogo(saved, input.logoFile);
  },

  /** PATCH /admin/brands/:id (+ logo upload). */
  async updateBrand(id: string, input: BrandInput): Promise<Brand> {
    const saved = await adminApi.patch<ApiBrand>(`/brands/${id}`, toBody(input));
    return withLogo(saved, input.logoFile);
  },

  /** POST /admin/brands/:id/logo (multipart). */
  async uploadLogo(id: string, file: File): Promise<Brand> {
    return toBrand(await adminApi.upload<ApiBrand>(`/brands/${id}/logo`, file));
  },

  /** PATCH /admin/brands/:id/status */
  async setStatus(id: string, status: Brand['status']): Promise<Brand> {
    return toBrand(await adminApi.patch<ApiBrand>(`/brands/${id}/status`, { status }));
  },

  /** DELETE /admin/brands/:id — 409 while products still use the brand. */
  async deleteBrand(id: string): Promise<void> {
    await adminApi.delete(`/brands/${id}`);
  },
};
