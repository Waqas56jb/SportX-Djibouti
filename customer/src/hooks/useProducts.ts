import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/services';
import { productService, type FeaturedKind } from '@/services/productService';
import type { AsyncStatus, Product, ProductListResult, ProductQuery } from '@/types';
import { useAsync } from './useAsync';

export interface ProductListState {
  data: ProductListResult | undefined;
  error: string | null;
  status: AsyncStatus;
  /** Any request in flight (first page, refetch or next page). */
  loading: boolean;
  /** Only the next page is loading ("Load more"). */
  loadingMore: boolean;
  reload: () => void;
}

const merge = (a: Product[], b: Product[]) => {
  const seen = new Set(a.map((p) => p.id));
  return [...a, ...b.filter((p) => !seen.has(p.id))];
};

/**
 * Paginated, filterable product listing. The API returns ONE page per call: when only `page`
 * grows by one the next page is appended; any other change (filters, sort, collection) refetches
 * pages 1…page. Previous results stay visible while refetching and stale responses are ignored.
 */
export function useProducts(query: ProductQuery): ProductListState {
  const { page: rawPage = 1, ...base } = query;
  const page = Math.max(1, rawPage);
  const baseKey = JSON.stringify(base);
  const [data, setData] = useState<ProductListResult | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [nonce, setNonce] = useState(0);
  const loaded = useRef<{ key: string; page: number; nonce: number } | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    const prev = loaded.current;
    const append = prev && prev.key === baseKey && prev.nonce === nonce && page === prev.page + 1;
    const q = JSON.parse(baseKey) as ProductQuery;
    setStatus('loading');
    setError(null);
    setLoadingMore(Boolean(append));

    const run = append
      ? productService.list({ ...q, page }).then((next) => ({ ...next, items: merge(data?.items ?? [], next.items) }))
      : Promise.all(Array.from({ length: page }, (_, i) => productService.list({ ...q, page: i + 1 }))).then((pages) => {
          const last = pages[pages.length - 1];
          return { ...last, items: pages.reduce<Product[]>((acc, p) => merge(acc, p.items), []), facets: pages[0].facets };
        });

    run
      .then((result) => {
        if (id !== requestId.current) return;
        loaded.current = { key: baseKey, page, nonce };
        setData(result);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(errorMessage(err));
        setStatus('error');
      })
      .finally(() => {
        if (id === requestId.current) setLoadingMore(false);
      });
    // `data` is read only to append; it must not retrigger the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey, page, nonce]);

  const reload = useCallback(() => {
    loaded.current = null;
    setNonce((n) => n + 1);
  }, []);

  return { data, error, status, loading: status === 'loading', loadingMore, reload };
}

export function useProduct(slug: string | undefined) {
  return useAsync(() => productService.getBySlug(slug ?? ''), [slug], { enabled: Boolean(slug) });
}

export function useFeaturedProducts(kind: FeaturedKind, limit = 8) {
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

export function useCategories() {
  return useAsync(() => productService.categories(), []);
}
