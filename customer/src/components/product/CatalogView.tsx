import { ChevronDown, PackageSearch, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Drawer, EmptyState, ErrorState } from '@/components/common';
import { getSortOptions } from '@/constants/labels';
import { useCatalogParams, type MultiFilterKey } from '@/hooks/useCatalogParams';
import { useProducts } from '@/hooks/useProducts';
import type { ProductQuery } from '@/types';
import { cn } from '@/utils/cn';
import { useT } from '@/i18n';
import { ActiveFilters, FilterPanel } from './filters/FilterPanel';
import { ProductGrid, ProductGridSkeleton } from './ProductGrid';

interface CatalogViewProps {
  base: Pick<ProductQuery, 'collection' | 'q' | 'categories'>;
  hideFilters?: MultiFilterKey[];
  /** Rendered when no products match. */
  emptyState?: ReactNode;
  onTotal?: (total: number) => void;
}

/**
 * Filterable, sortable product listing shared by every collection,
 * category and search page. Sidebar filters on desktop, drawer on mobile.
 */
export function CatalogView({ base, hideFilters, emptyState, onTotal }: CatalogViewProps) {
  const { t } = useT();
  const catalog = useCatalogParams();
  const query = catalog.toQuery(base);
  const { data, loading, loadingMore, error, reload } = useProducts(query);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [desktopFilters, setDesktopFilters] = useState(true);

  useEffect(() => {
    if (data) onTotal?.(data.total);
  }, [data, onTotal]);

  const total = data?.total ?? 0;
  const firstLoad = loading && !data;
  const refreshing = loading && Boolean(data) && !loadingMore;

  const sortSelect = (
    <div className="relative min-w-0">
      <label htmlFor="sort" className="sr-only">
        {t('catalog.toolbar.sortBy')}
      </label>
      <select
        id="sort"
        value={catalog.state.sort}
        onChange={(e) => catalog.setSingle('sort', e.target.value === 'featured' ? undefined : e.target.value)}
        className="min-h-[44px] w-full max-w-[60vw] cursor-pointer appearance-none truncate sm:max-w-none border border-paper-300 bg-white py-2 pe-10 ps-4 text-sm font-medium hover:border-ink focus:border-ink focus:outline-none"
      >
        {getSortOptions().map((o) => (
          <option key={o.value} value={o.value}>
            {t('catalog.toolbar.sortOption', { label: o.label })}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden />
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="-mx-4 border-b border-paper-200 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:border-0 lg:px-0">
        <div className="flex items-center justify-between gap-3 py-3 lg:py-0">
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="btn btn-sm btn-outline min-h-[44px] lg:hidden"
              aria-haspopup="dialog"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {t('catalog.toolbar.filters')}{catalog.activeCount > 0 && <span className="ms-0.5 rounded-full bg-accent px-1.5 text-[10px] text-ink">{catalog.activeCount}</span>}
            </button>
            <button
              type="button"
              onClick={() => setDesktopFilters((v) => !v)}
              className="hidden min-h-[44px] items-center gap-2 text-sm font-medium lg:inline-flex"
              aria-expanded={desktopFilters}
              aria-controls="filters-sidebar"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {desktopFilters ? t('catalog.toolbar.hideFilters') : t('catalog.toolbar.showFilters')}
            </button>
            <p className="hidden text-sm text-ink-500 sm:block" aria-live="polite">
              {firstLoad ? t('common.states.loading') : t('common.labels.products', { count: total })}
            </p>
          </div>
          {sortSelect}
        </div>
      </div>

      <div className={cn('mt-6 lg:grid lg:gap-10', desktopFilters ? 'lg:grid-cols-[260px_1fr] xl:grid-cols-[280px_1fr]' : 'lg:grid-cols-1')}>
        {desktopFilters && (
          <aside id="filters-sidebar" className="hidden lg:block" aria-label={t('catalog.toolbar.productFilters')}>
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-10 pe-2">
              <FilterPanel facets={data?.facets} catalog={catalog} hide={hideFilters} />
            </div>
          </aside>
        )}

        <div className="min-w-0">
          <ActiveFilters facets={data?.facets} catalog={catalog} />
          <div className={cn('transition-opacity duration-300', catalog.activeCount > 0 && 'mt-6', refreshing && 'opacity-50')} aria-busy={loading}>
            {error && !data ? (
              <ErrorState message={error} onRetry={reload} />
            ) : firstLoad ? (
              <ProductGridSkeleton count={9} columns={desktopFilters ? 3 : 4} />
            ) : total === 0 ? (
              (emptyState ?? (
                <EmptyState
                  icon={<PackageSearch />}
                  title={t('catalog.empty.title')}
                  description={t('catalog.empty.description')}
                  action={
                    catalog.activeCount > 0 ? (
                      <Button variant="primary" onClick={catalog.clearAll}>
                        {t('catalog.empty.clearFilters')}
                      </Button>
                    ) : undefined
                  }
                />
              ))
            ) : (
              <>
                <ProductGrid products={data?.items ?? []} columns={desktopFilters ? 3 : 4} priorityCount={4} />
                <div className="mt-14 flex flex-col items-center gap-4">
                  <p className="text-sm text-ink-500">
                    {t('catalog.toolbar.showing', { shown: data?.items.length ?? 0, total })}
                  </p>
                  <div className="h-[2px] w-48 bg-paper-200">
                    <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${((data?.items.length ?? 0) / Math.max(total, 1)) * 100}%` }} />
                  </div>
                  {error && <p className="text-sm text-danger">{error} <button type="button" className="font-semibold underline" onClick={reload}>{t('common.actions.retry')}</button></p>}
                  {data?.hasMore && (
                    <Button variant="outline" size="lg" onClick={catalog.loadMore} loading={loadingMore} disabled={loading} className="mt-2 min-w-[220px]">
                      {t('common.actions.loadMore')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        side="left"
        title={t('catalog.toolbar.filters')}
        headerExtra={catalog.activeCount > 0 ? <span className="text-sm text-ink-500">({catalog.activeCount})</span> : undefined}
        footer={
          <div className="grid grid-cols-2 gap-3 p-4">
            <Button variant="outline" onClick={catalog.clearAll} disabled={catalog.activeCount === 0}>
              {t('common.actions.clear')}
            </Button>
            <Button variant="primary" onClick={() => setFiltersOpen(false)} loading={refreshing}>
              {t('catalog.toolbar.showResults', { count: total })}
            </Button>
          </div>
        }
      >
        <div className="px-5">
          <FilterPanel facets={data?.facets} catalog={catalog} hide={hideFilters} />
        </div>
      </Drawer>
    </div>
  );
}
