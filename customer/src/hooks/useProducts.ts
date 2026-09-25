import { productService } from '@/services';
import type { ProductQuery } from '@/types';
import { useAsync } from './useAsync';

/** Paginated, filterable product listing. Keeps previous results visible while refetching. */
export function useProducts(query: ProductQuery) {
  const key = JSON.stringify(query);
  return useAsync(() => productService.list(query), [key], { keepPrevious: true });
}

export function useProduct(slug: string | undefined) {
  return useAsync(() => productService.getBySlug(slug ?? ''), [slug], { enabled: Boolean(slug) });
}

export function useFeaturedProducts(kind: Parameters<typeof productService.getFeatured>[0], limit = 8) {
  return useAsync(() => productService.getFeatured(kind, limit), [kind, limit]);
}

export function useProductsBySlugs(slugs: string[]) {
  const key = slugs.join('|');
  return useAsync(() => productService.getBySlugs(slugs), [key], { keepPrevious: true });
}

export function useProductsByIds(ids: string[]) {
  const key = ids.join('|');
  return useAsync(() => productService.getByIds(ids), [key], { keepPrevious: true });
}
