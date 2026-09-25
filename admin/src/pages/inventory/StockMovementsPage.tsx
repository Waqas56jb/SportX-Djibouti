import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Boxes, Download, History, X } from 'lucide-react';
import type { MovementReason, StockMovement } from '@/types';
import { inventoryService, type MovementFilters } from '@/services/inventoryService';
import { productService } from '@/services/productService';
import { settingsService } from '@/services/settingsService';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/misc';
import { usePermission } from '@/hooks/usePermission';
import { labelOf } from '@/constants/catalog';
import { exportCsv } from '@/utils/csv';
import { formatDate, formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { toast } from '@/store/toastStore';
import { Avatar, Button, EmptyState, PageHeader, StatusBadge } from '@/components/common';
import { DateInput, FilterSelect, SearchInput } from '@/components/forms';
import { BulkButton, ClearFiltersButton, DataTable, type Column, type SortState } from '@/components/tables';
import { MOVEMENT_CSV, MOVEMENT_REASONS, STOCK_ACTION } from '@/components/inventory/inventoryMeta';

const DIRECTION_OPTIONS = [
  { value: 'in', label: 'Stock in' },
  { value: 'out', label: 'Stock out' },
];

export default function StockMovementsPage() {
  const navigate = useNavigate();
  const canExport = usePermission('inventory:export');
  const canSeeAdmins = usePermission('settings:view');
  const { filters, setFilter, resetFilters, activeCount } = useUrlFilters({ search: '', from: '', to: '', product: '', direction: '', reason: '', admin: '', variant: '' });
  const [search, setSearch] = useState(filters.search);
  const debounced = useDebounce(search, 250);
  useEffect(() => {
    if (debounced !== filters.search) setFilter('search', debounced);
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const dateError = filters.from && filters.to && filters.from > filters.to ? 'Start date is after end date.' : undefined;
  const [sort, setSort] = useState<SortState>({ id: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const base: MovementFilters = {
    search: filters.search || undefined,
    direction: (filters.direction as MovementFilters['direction']) || undefined,
    reason: (filters.reason as MovementReason) || undefined,
    adminId: filters.admin || undefined,
    productId: filters.product || undefined,
    variantId: filters.variant || undefined,
    from: dateError ? undefined : filters.from || undefined,
    to: dateError ? undefined : filters.to || undefined,
    sort: sort.id === 'quantity' ? 'change' : 'created_at',
    order: sort.dir,
  };
  const baseKey = JSON.stringify(base);
  useEffect(() => setPage(1), [baseKey]);
  const query: MovementFilters = { ...base, page, pageSize };
  const { data: pageData, loading, error, reload } = useAsync(() => inventoryService.listMovements(query), [JSON.stringify(query)]);
  const data = pageData?.data;
  const total = pageData?.pagination.total ?? 0;
  const [exporting, setExporting] = useState(false);

  const products = useAsync(() => productService.getProducts(), []);
  const admins = useAsync(() => (canSeeAdmins ? settingsService.getAdminUsers() : Promise.resolve([])), [canSeeAdmins]);
  const variantRef = useAsync(() => (filters.variant ? inventoryService.getItem(filters.variant).catch(() => null) : Promise.resolve(null)), [filters.variant]);

  const productOptions = useMemo(() => (products.data ?? []).map((p) => ({ value: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label)), [products.data]);
  const adminOptions = useMemo(() => {
    const map = new Map<string, string>();
    (admins.data ?? []).forEach((a) => map.set(a.id, a.name));
    (data ?? []).forEach((m) => m.adminId && map.set(m.adminId, m.adminName));
    return [...map].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [admins.data, data]);

  const doExport = (rows: StockMovement[], name = 'stock-movements') => {
    if (!rows.length) return toast.info('Nothing to export.');
    exportCsv(name, rows, MOVEMENT_CSV);
    toast.success(`Exported ${rows.length} movement${rows.length === 1 ? '' : 's'}.`);
  };
  const exportAll = async () => {
    setExporting(true);
    try {
      doExport(await inventoryService.getMovements(base));
    } catch (e) {
      toast.error('Could not export movements.', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<StockMovement>[] = [
    {
      id: 'date',
      header: 'Date',
      sortValue: (m) => m.createdAt,
      mobile: 'subtitle',
      cell: (m) => (
        <div className="whitespace-nowrap">
          <div className="text-zinc-900">{formatDate(m.createdAt)}</div>
          <div className="text-xs text-zinc-500 tabular">{formatTime(m.createdAt)}</div>
        </div>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      mobile: 'title',
      hideable: false,
      cell: (m) => (
        <div className="min-w-[180px]">
          <Link to={`/products/${m.productId}`} className="font-medium text-zinc-900 hover:underline">
            {m.productName}
          </Link>
          <div className="font-mono text-xs text-zinc-500">{m.sku}</div>
        </div>
      ),
    },
    { id: 'variant', header: 'Variant', cell: (m) => <span className="whitespace-nowrap text-zinc-700">{m.variantLabel}</span> },
    { id: 'action', header: 'Action', mobile: 'aside', cell: (m) => <StatusBadge map={STOCK_ACTION} value={m.action} dot={false} /> },
    {
      id: 'quantity',
      header: 'Quantity',
      align: 'right',
      sortValue: (m) => m.quantity,
      mobile: 'aside',
      cell: (m) => <span className={cn('font-semibold tabular', m.quantity > 0 ? 'text-emerald-700' : m.quantity < 0 ? 'text-red-600' : 'text-zinc-500')}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity < 0 ? `−${Math.abs(m.quantity)}` : '0'}</span>,
    },
    { id: 'previous', header: 'Previous', label: 'Previous stock', align: 'right', cell: (m) => <span className="tabular text-zinc-500">{m.previousStock}</span> },
    { id: 'new', header: 'New stock', align: 'right', cell: (m) => <span className="font-medium tabular text-zinc-900">{m.newStock}</span> },
    {
      id: 'reason',
      header: 'Reason',
      cell: (m) => (
        <div className="max-w-[220px]">
          <div className="text-zinc-800">
            {labelOf(MOVEMENT_REASONS, m.reason)}
            {m.orderId && m.orderNumber && (
              <>
                {' · '}
                <Link to={`/orders/${m.orderId}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                  #{m.orderNumber}
                </Link>
              </>
            )}
          </div>
          {m.notes && (
            <div className="truncate text-xs text-zinc-500" title={m.notes}>
              {m.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'admin',
      header: 'Admin',
      cell: (m) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <Avatar name={m.adminName} size={22} /> {m.adminName}
        </span>
      ),
    },
  ];

  const clearAll = () => {
    resetFilters();
    setSearch('');
  };

  return (
    <>
      <PageHeader
        title="Stock movements"
        description="Audit trail of every stock change — manual adjustments, sales, cancellations and returns."
        backTo="/inventory"
        backLabel="Inventory"
        actions={
          canExport && (
            <Button variant="secondary" icon={Download} onClick={() => void exportAll()} disabled={!total} loading={exporting}>
              Export CSV
            </Button>
          )
        }
      />

      {(filters.variant || filters.product) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] text-zinc-500">Showing history for</span>
          {filters.variant && (
            <FilterChip onClear={() => setFilter('variant', '')}>
              Variant: {variantRef.data ? `${variantRef.data.productName} · ${variantRef.data.variantLabel}` : filters.variant}
            </FilterChip>
          )}
          {filters.product && <FilterChip onClear={() => setFilter('product', '')}>Product: {productOptions.find((p) => p.value === filters.product)?.label ?? filters.product}</FilterChip>}
        </div>
      )}

      <DataTable
        caption="Stock movement history"
        storageKey="stock-movements"
        data={data}
        columns={columns}
        getRowId={(m) => m.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        sort={sort}
        onSortChange={setSort}
        serverPagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: (n) => {
            setPageSize(n);
            setPage(1);
          },
        }}
        selectable={canExport}
        bulkActions={(ids, clear) => (
          <BulkButton
            icon={Download}
            onClick={() => {
              doExport((data ?? []).filter((m) => ids.includes(m.id)), 'stock-movements-selection');
              clear();
            }}
          >
            Export selected
          </BulkButton>
        )}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Search product, SKU, note or order…" className="w-full sm:w-64" />
            <FilterSelect label="Product" value={filters.product} onChange={(v) => setFilter('product', v)} options={productOptions} className="max-w-[240px]" />
            <FilterSelect label="Direction" value={filters.direction} onChange={(v) => setFilter('direction', v)} options={DIRECTION_OPTIONS} />
            <FilterSelect label="Reason" value={filters.reason} onChange={(v) => setFilter('reason', v)} options={MOVEMENT_REASONS} />
            {adminOptions.length > 0 && <FilterSelect label="Admin" value={filters.admin} onChange={(v) => setFilter('admin', v)} options={adminOptions} />}
            <div className="flex items-center gap-1.5">
              <DateInput aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} inputClassName="h-8 w-[140px] text-[0.8125rem]" />
              <span className="text-xs text-zinc-400">to</span>
              <DateInput aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} inputClassName="h-8 w-[140px] text-[0.8125rem]" />
            </div>
            {dateError && <span role="alert" className="text-xs font-medium text-red-600">{dateError}</span>}
            <ClearFiltersButton count={activeCount} onClear={clearAll} />
          </>
        }
        toolbarRight={<span className="hidden text-xs text-zinc-500 tabular sm:inline">{total} movements</span>}
        empty={
          activeCount || filters.search ? (
            <EmptyState icon={History} title="No movements match these filters" description={dateError ?? 'Try widening the date range or clearing filters.'} action={<Button size="sm" onClick={clearAll}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={History} title="No stock movements yet" description="Adjustments, sales and returns will be logged here." action={<Button size="sm" variant="primary" icon={Boxes} onClick={() => navigate('/inventory')}>Go to inventory</Button>} />
          )
        }
      />
    </>
  );
}

function FilterChip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-900 bg-zinc-900 py-1 pl-3 pr-1.5 text-[0.8125rem] font-medium text-white">
      <span className="truncate">{children}</span>
      <button type="button" onClick={onClear} aria-label="Remove filter" className="rounded-full p-0.5 text-zinc-400 hover:bg-white/10 hover:text-white">
        <X size={13} aria-hidden />
      </button>
    </span>
  );
}
