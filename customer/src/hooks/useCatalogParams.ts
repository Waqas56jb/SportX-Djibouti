import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Gender, ProductQuery, SortKey, Sport } from '@/types';

export type MultiFilterKey = 'category' | 'brand' | 'size' | 'color' | 'gender' | 'sport';

const MULTI: MultiFilterKey[] = ['category', 'brand', 'size', 'color', 'gender', 'sport'];
const SORTS: SortKey[] = ['featured', 'newest', 'price-asc', 'price-desc', 'rating', 'popular'];

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);

/**
 * Catalog filters live in the URL (shareable, back-button friendly).
 * This hook is the single source of truth for reading and updating them.
 */
export function useCatalogParams() {
  const [params, setParams] = useSearchParams();

  const state = useMemo(
    () => ({
      category: list(params.get('category')),
      brand: list(params.get('brand')),
      size: list(params.get('size')),
      color: list(params.get('color')),
      gender: list(params.get('gender')) as Gender[],
      sport: list(params.get('sport')) as Sport[],
      minPrice: num(params.get('min')),
      maxPrice: num(params.get('max')),
      minRating: num(params.get('rating')),
      inStock: params.get('stock') === '1',
      sort: (SORTS.includes(params.get('sort') as SortKey) ? params.get('sort') : 'featured') as SortKey,
      page: Math.max(1, num(params.get('page')) ?? 1),
      q: params.get('q') ?? '',
    }),
    [params],
  );

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void, { resetPage = true } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          if (resetPage) next.delete('page');
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setParams],
  );

  const toggle = useCallback(
    (key: MultiFilterKey, value: string) =>
      update((next) => {
        const current = list(next.get(key));
        const values = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
        if (values.length) next.set(key, values.join(','));
        else next.delete(key);
      }),
    [update],
  );

  const setPrice = useCallback(
    (min?: number, max?: number) =>
      update((next) => {
        if (min !== undefined) next.set('min', String(min));
        else next.delete('min');
        if (max !== undefined) next.set('max', String(max));
        else next.delete('max');
      }),
    [update],
  );

  const setSingle = useCallback(
    (key: 'rating' | 'stock' | 'sort', value: string | undefined) =>
      update((next) => {
        if (value) next.set(key, value);
        else next.delete(key);
      }),
    [update],
  );

  const loadMore = useCallback(() => update((next) => next.set('page', String(state.page + 1)), { resetPage: false }), [update, state.page]);

  const clearAll = useCallback(
    () =>
      update((next) => {
        [...MULTI, 'min', 'max', 'rating', 'stock'].forEach((k) => next.delete(k));
      }),
    [update],
  );

  const activeCount =
    MULTI.reduce((n, k) => n + state[k].length, 0) +
    (state.minPrice !== undefined || state.maxPrice !== undefined ? 1 : 0) +
    (state.minRating ? 1 : 0) +
    (state.inStock ? 1 : 0);

  const toQuery = (base: Partial<ProductQuery>): ProductQuery => ({
    ...base,
    categories: state.category,
    brands: state.brand,
    sizes: state.size,
    colors: state.color,
    genders: state.gender,
    sports: state.sport,
    minPrice: state.minPrice,
    maxPrice: state.maxPrice,
    minRating: state.minRating,
    inStockOnly: state.inStock,
    sort: state.sort,
    page: state.page,
  });

  return { state, toggle, setPrice, setSingle, loadMore, clearAll, activeCount, toQuery };
}

export type CatalogParams = ReturnType<typeof useCatalogParams>;
