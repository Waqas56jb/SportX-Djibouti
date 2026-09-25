import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, PackageSearch } from 'lucide-react';
import type { TopProduct } from '@/types';
import { brandService, categoryService, reportService } from '@/services';
import type { ProductReportFilters } from '@/services/reportService';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/misc';
import { EmptyState, ProductThumb } from '@/components/common';
import { FilterSelect, SearchInput } from '@/components/forms';
import { ClearFiltersButton, DataTable, type Column, type SortState } from '@/components/tables';
import { ReportHeader, rangeLabel } from '@/components/reports/ReportHeader';
import { BestSellersPanel, WorstPerformersPanel } from '@/components/reports/ProductPerformance';
import { useReportRange } from '@/components/reports/useReportRange';
import { categoryOptions } from '@/components/catalog/categoryTree';
import { SPORTS } from '@/constants/catalog';
import { formatMoney, formatNumber, formatPercent } from '@/utils/format';

const CONVERSION_NOTE = 'Estimated: units sold in the period ÷ lifetime product page views.';

/** Table column → API sort key. */
const SORT_KEY: Record<string, NonNullable<ProductReportFilters['sort']>> = {
  name: 'name',
  units: 'units',
  revenue: 'revenue',
  views: 'views',
  conversion: 'conversion',
  stock: 'stock',
};

const columns: Column<TopProduct>[] = [
  {
    id: 'name',
    header: 'Product',
    hideable: false,
    mobile: 'title',
    sortValue: (r) => r.name,
    cell: (r) => (
      <div className="flex min-w-0 items-center gap-3">
        <ProductThumb src={r.image} alt={r.name} size={36} />
        <Link to={`/products/${r.productId}`} onClick={(e) => e.stopPropagation()} className="block max-w-[240px] truncate font-semibold text-zinc-900 hover:underline">
          {r.name}
        </Link>
      </div>
    ),
  },
  { id: 'brand', header: 'Brand', mobile: 'subtitle', cell: (r) => r.brand },
  { id: 'category', header: 'Category', cell: (r) => r.category },
  { id: 'units', header: 'Units', align: 'right', sortValue: (r) => r.unitsSold, cell: (r) => <span className="tabular">{formatNumber(r.unitsSold)}</span> },
  { id: 'revenue', header: 'Revenue', align: 'right', mobile: 'aside', sortValue: (r) => r.revenue, cell: (r) => <span className="whitespace-nowrap font-semibold text-zinc-900 tabular">{formatMoney(r.revenue)}</span> },
  { id: 'views', header: 'Views', align: 'right', sortValue: (r) => r.views, cell: (r) => <span className="tabular">{formatNumber(r.views)}</span> },
  {
    id: 'conversion',
    label: 'Conversion % (estimated)',
    header: (
      <span className="inline-flex items-center gap-1" title={CONVERSION_NOTE}>
        Conv. %<Info size={12} aria-label={CONVERSION_NOTE} />
      </span>
    ),
    align: 'right',
    sortValue: (r) => r.conversion,
    cell: (r) => <span className="tabular text-zinc-600">{r.views ? formatPercent(r.conversion, { decimals: 2 }) : '—'}</span>,
  },
  {
    id: 'stock',
    header: 'Stock',
    align: 'right',
    sortValue: (r) => r.stock,
    cell: (r) => <span className={r.stock === 0 ? 'font-semibold text-red-600 tabular' : 'tabular'}>{r.stock === 0 ? 'Out of stock' : formatNumber(r.stock)}</span>,
  },
];

export default function ProductReportPage() {
  const rs = useReportRange('30d');
  const { filters, setFilter, resetFilters, activeCount } = useUrlFilters({ category: '', brand: '', sport: '', search: '' });
  const [search, setSearch] = useState(filters.search);
  const debounced = useDebounce(search, 300);
  useEffect(() => {
    if (debounced !== filters.search) setFilter('search', debounced);
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const brands = useAsync(() => brandService.getBrands(), []);
  const categories = useAsync(() => categoryService.getCategories(), []);
  const categoryOpts = useMemo(() => categoryOptions(categories.data ?? []), [categories.data]);

  const [sort, setSort] = useState<SortState>({ id: 'revenue', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const base: ProductReportFilters = {
    categoryId: filters.category || undefined,
    brandId: filters.brand || undefined,
    sport: filters.sport || undefined,
    search: filters.search || undefined,
    sort: SORT_KEY[sort.id] ?? 'revenue',
    order: sort.dir,
  };
  const baseKey = `${rs.key}|${JSON.stringify(base)}`;
  useEffect(() => setPage(1), [baseKey]);
  const { data, loading, error, reload } = useAsync(() => reportService.getProductReport(rs.range, { ...base, page, pageSize }), [baseKey, page, pageSize]);
  const label = rangeLabel(rs);
  const retry = () => void reload();

  // Server-generated CSV with every matching product (not just the current page).
  const onExport = () =>
    reportService.exportReport('products', rs.range, { category: base.categoryId, brand: base.brandId, sport: base.sport, search: base.search, sort: base.sort, order: base.order });

  const filterBar = (
    <>
      <SearchInput value={search} onChange={setSearch} placeholder="Search name or SKU…" label="Search products" className="w-full sm:w-56" />
      <FilterSelect label="Category" value={filters.category} onChange={(v) => setFilter('category', v)} options={categoryOpts} />
      <FilterSelect label="Brand" value={filters.brand} onChange={(v) => setFilter('brand', v)} options={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))} />
      <FilterSelect label="Sport" value={filters.sport} onChange={(v) => setFilter('sport', v)} options={SPORTS} />
      <ClearFiltersButton
        count={activeCount + (filters.search ? 1 : 0)}
        onClear={() => {
          resetFilters();
          setSearch('');
        }}
      />
    </>
  );

  return (
    <div>
      <ReportHeader title="Product performance" description="Which products sell, which stall, and how views turn into orders." rangeState={rs} filters={filterBar} onExport={onExport} exportDisabled={!data?.total} periodLabel={label} />

      <div className="grid gap-4 xl:grid-cols-5">
        <BestSellersPanel rows={data?.best} loading={loading} error={error} onRetry={retry} />
        <WorstPerformersPanel rows={data?.worst} loading={loading} error={error} onRetry={retry} />
      </div>

      <div className="mt-6">
        <DataTable
          caption={`Product performance, ${label}`}
          data={data?.items}
          columns={columns}
          getRowId={(r) => r.productId}
          loading={loading}
          error={error}
          onRetry={retry}
          sort={sort}
          onSortChange={setSort}
          serverPagination={{
            page,
            pageSize,
            total: data?.total ?? 0,
            onPageChange: setPage,
            onPageSizeChange: (n) => {
              setPageSize(n);
              setPage(1);
            },
          }}
          storageKey="report-products"
          toolbar={
            <div>
              <h2 className="panel-title">All products</h2>
              <p className="mt-0.5 text-xs text-zinc-500">{CONVERSION_NOTE}</p>
            </div>
          }
          empty={<EmptyState compact icon={PackageSearch} title="No products match these filters" description="Try another category, brand or sport." />}
        />
      </div>
    </div>
  );
}
