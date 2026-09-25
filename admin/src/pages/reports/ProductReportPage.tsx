import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Info, PackageSearch } from 'lucide-react';
import type { TopProduct } from '@/types';
import { brandService, reportService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { EmptyState, ProductThumb } from '@/components/common';
import { FilterSelect } from '@/components/forms/Inputs';
import { ClearFiltersButton, DataTable, type Column } from '@/components/tables';
import { ReportHeader, rangeLabel } from '@/components/reports/ReportHeader';
import { BestSellersPanel, WorstPerformersPanel } from '@/components/reports/ProductPerformance';
import { useProductIndex, type ProductIndexEntry } from '@/components/reports/useProductIndex';
import { useReportRange } from '@/components/reports/useReportRange';
import { SPORTS } from '@/constants/catalog';
import { exportCsv } from '@/utils/csv';
import { formatMoney, formatNumber, formatPercent } from '@/utils/format';

const CATEGORIES = ['Football', 'Basketball', 'Running', 'Training', 'Apparel', 'Equipment'].map((c) => ({ value: c, label: c }));
const CONVERSION_NOTE = 'Estimated from product views until storefront analytics is connected.';

function buildColumns(index: Map<string, ProductIndexEntry>): Column<TopProduct>[] {
  return [
    {
      id: 'name',
      header: 'Product',
      hideable: false,
      mobile: 'title',
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb src={index.get(r.productId)?.image} alt={r.name} size={36} />
          <Link to={`/products/${r.productId}`} onClick={(e) => e.stopPropagation()} className="block max-w-[240px] truncate font-semibold text-zinc-900 hover:underline">
            {r.name}
          </Link>
        </div>
      ),
    },
    { id: 'brand', header: 'Brand', mobile: 'subtitle', sortValue: (r) => r.brand, cell: (r) => r.brand },
    { id: 'category', header: 'Category', sortValue: (r) => r.category, cell: (r) => r.category },
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
      cell: (r) => <span className="tabular text-zinc-600">{formatPercent(r.conversion, { decimals: 2 })}</span>,
    },
    {
      id: 'stock',
      header: 'Stock',
      align: 'right',
      sortValue: (r) => r.stock,
      cell: (r) => <span className={r.stock === 0 ? 'font-semibold text-red-600 tabular' : 'tabular'}>{r.stock === 0 ? 'Out of stock' : formatNumber(r.stock)}</span>,
    },
  ];
}

export default function ProductReportPage() {
  const rs = useReportRange('30d');
  const { filters, setFilter, resetFilters, activeCount } = useUrlFilters({ category: '', brand: '', sport: '' });
  const brands = useAsync(() => brandService.getBrands(), []);
  const { map } = useProductIndex();
  const { data, loading, error, reload } = useAsync(
    () => reportService.getProductReport(rs.range, { categoryName: filters.category || undefined, brand: filters.brand || undefined, sport: filters.sport || undefined }),
    [rs.key, filters.category, filters.brand, filters.sport],
  );
  const label = rangeLabel(rs);
  const retry = () => void reload();
  const columns = useMemo(() => buildColumns(map), [map]);

  const onExport = () =>
    data &&
    exportCsv('product-report', data, [
      { header: 'Product', value: (r) => r.name },
      { header: 'Brand', value: (r) => r.brand },
      { header: 'Category', value: (r) => r.category },
      { header: 'Units sold', value: (r) => r.unitsSold },
      { header: 'Revenue', value: (r) => r.revenue },
      { header: 'Views', value: (r) => r.views },
      { header: 'Conversion % (estimated)', value: (r) => r.conversion.toFixed(2) },
      { header: 'Stock', value: (r) => r.stock },
    ]);

  const filterBar = (
    <>
      <FilterSelect label="Category" value={filters.category} onChange={(v) => setFilter('category', v)} options={CATEGORIES} />
      <FilterSelect label="Brand" value={filters.brand} onChange={(v) => setFilter('brand', v)} options={(brands.data ?? []).map((b) => ({ value: b.name, label: b.name }))} />
      <FilterSelect label="Sport" value={filters.sport} onChange={(v) => setFilter('sport', v)} options={SPORTS} />
      <ClearFiltersButton count={activeCount} onClear={resetFilters} />
    </>
  );

  return (
    <div>
      <ReportHeader title="Product performance" description="Which products sell, which stall, and how views turn into orders." rangeState={rs} filters={filterBar} onExport={onExport} exportDisabled={!data?.length} periodLabel={label} />

      <div className="grid gap-4 xl:grid-cols-5">
        <BestSellersPanel rows={data} loading={loading} error={error} onRetry={retry} />
        <WorstPerformersPanel rows={data} loading={loading} error={error} onRetry={retry} index={map} />
      </div>

      <div className="mt-6">
        <DataTable
          caption={`Product performance, ${label}`}
          data={data}
          columns={columns}
          getRowId={(r) => r.productId}
          loading={loading}
          error={error}
          onRetry={retry}
          initialSort={{ id: 'revenue', dir: 'desc' }}
          storageKey="report-products"
          toolbar={
            <div>
              <h2 className="panel-title">All products</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Conversion % is estimated from product views until storefront analytics is connected.</p>
            </div>
          }
          empty={<EmptyState compact icon={PackageSearch} title="No products match these filters" description="Try another category, brand or sport." action={activeCount ? <ClearFiltersButton count={activeCount} onClear={resetFilters} /> : undefined} />}
        />
      </div>
    </div>
  );
}
