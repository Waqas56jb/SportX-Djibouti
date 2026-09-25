import type { Category, CategoryInput } from '@/types';
import { adminApi } from './api';
import { isRemoteUrl, toCategory, type ApiCategory } from './catalogMappers';

function toBody(input: Partial<CategoryInput>) {
  const { imageFile: _f, imageUrl, ...rest } = input;
  return {
    ...rest,
    // Local previews (blob:) are uploaded separately; `undefined` in the form means "no image".
    ...(imageUrl === undefined || imageUrl === '' ? { imageUrl: null } : isRemoteUrl(imageUrl) ? { imageUrl } : {}),
  };
}

async function withImage(saved: ApiCategory, file?: File): Promise<Category> {
  if (!file) return toCategory(saved);
  return toCategory(await adminApi.upload<ApiCategory>(`/categories/${saved.id}/image`, file));
}

export const categoryService = {
  /** GET /admin/categories — flat list (tree order) with depth and product counts. */
  async getCategories(): Promise<Category[]> {
    const list = await adminApi.get<ApiCategory[]>('/categories');
    return list.map(toCategory);
  },

  /** POST /admin/categories (+ POST /:id/image when a new image was picked). */
  async createCategory(input: CategoryInput): Promise<Category> {
    const saved = await adminApi.post<ApiCategory>('/categories', toBody(input));
    return withImage(saved, input.imageFile);
  },

  /** PATCH /admin/categories/:id (+ image upload). */
  async updateCategory(id: string, input: CategoryInput): Promise<Category> {
    const saved = await adminApi.patch<ApiCategory>(`/categories/${id}`, toBody(input));
    return withImage(saved, input.imageFile);
  },

  /** POST /admin/categories/:id/image (multipart). */
  async uploadImage(id: string, file: File): Promise<Category> {
    return toCategory(await adminApi.upload<ApiCategory>(`/categories/${id}/image`, file));
  },

  /** PATCH /admin/categories/:id/status */
  async setStatus(id: string, status: Category['status']): Promise<Category> {
    return toCategory(await adminApi.patch<ApiCategory>(`/categories/${id}/status`, { status }));
  },

  /** PUT /admin/categories/order — sibling ids in their new display order. */
  async reorder(orderedIds: string[]): Promise<void> {
    await adminApi.put('/categories/order', { ids: orderedIds });
  },

  /** DELETE /admin/categories/:id — 409 when it still has sub-categories or products. */
  async deleteCategory(id: string): Promise<void> {
    await adminApi.delete(`/categories/${id}`);
  },
};
