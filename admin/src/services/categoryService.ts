import type { Category, CategoryInput } from '@/types';
import { appConfig } from '@/constants/config';
import { uid } from '@/utils/id';
import { api, ApiError } from './http';
import { audit, db, delay, NotFoundError, now } from './mock/db';

export const categoryService = {
  /** GET /categories */
  async getCategories(): Promise<Category[]> {
    if (!appConfig.useMocks) return api.get<Category[]>('/categories');
    return delay([...db.categories].sort((a, b) => a.position - b.position));
  },

  /** POST /categories */
  async createCategory(input: CategoryInput): Promise<Category> {
    if (!appConfig.useMocks) return api.post<Category>('/categories', input);
    if (db.categories.some((c) => c.slug === input.slug)) throw new ApiError('A category with this slug already exists.', 409, 'slug_taken');
    const cat: Category = { ...input, id: uid('cat'), productCount: 0, position: db.categories.length, createdAt: now(), updatedAt: now() };
    db.categories.push(cat);
    audit('Category created', 'Catalog', cat.name, '/categories');
    return delay(cat);
  },

  /** PUT /categories/:id */
  async updateCategory(id: string, input: CategoryInput): Promise<Category> {
    if (!appConfig.useMocks) return api.put<Category>(`/categories/${id}`, input);
    const cat = db.categories.find((c) => c.id === id);
    if (!cat) throw new NotFoundError('Category');
    if (db.categories.some((c) => c.id !== id && c.slug === input.slug)) throw new ApiError('A category with this slug already exists.', 409, 'slug_taken');
    if (input.parentId === id) throw new ApiError('A category cannot be its own parent.', 400);
    Object.assign(cat, input, { updatedAt: now() });
    audit('Category updated', 'Catalog', cat.name, '/categories');
    return delay(cat);
  },

  /** PATCH /categories/:id/status */
  async setStatus(id: string, status: Category['status']): Promise<Category> {
    if (!appConfig.useMocks) return api.patch<Category>(`/categories/${id}/status`, { status });
    const cat = db.categories.find((c) => c.id === id);
    if (!cat) throw new NotFoundError('Category');
    cat.status = status;
    cat.updatedAt = now();
    audit(status === 'active' ? 'Category enabled' : 'Category disabled', 'Catalog', cat.name, '/categories');
    return delay(cat);
  },

  /** PUT /categories/order — ids in their new display order (siblings only). */
  async reorder(orderedIds: string[]): Promise<void> {
    if (!appConfig.useMocks) return api.put('/categories/order', { ids: orderedIds });
    orderedIds.forEach((id, i) => {
      const c = db.categories.find((x) => x.id === id);
      if (c) c.position = i;
    });
    audit('Categories reordered', 'Catalog', `${orderedIds.length} categories`, '/categories');
    await delay(null, 200);
  },

  /** DELETE /categories/:id — refuses when products or children still reference it. */
  async deleteCategory(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.delete(`/categories/${id}`);
    const cat = db.categories.find((c) => c.id === id);
    if (!cat) throw new NotFoundError('Category');
    if (db.categories.some((c) => c.parentId === id)) throw new ApiError('Move or delete the sub-categories first.', 409, 'has_children');
    if (db.products.some((p) => p.categoryId === id)) throw new ApiError('This category still contains products. Reassign them first.', 409, 'has_products');
    db.categories = db.categories.filter((c) => c.id !== id);
    audit('Category deleted', 'Catalog', cat.name);
    await delay(null);
  },
};
