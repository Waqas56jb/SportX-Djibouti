import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Boxes, Download, History, X } from 'lucide-react';
import type { StockAction, StockMovement } from '@/types';
import { inventoryService, type MovementFilters } from '@/services/inventoryService';
import { settingsService } from '@/services/settingsService';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/misc';
import { usePermission } from '@/hooks/usePermission';
import { STOCK_REASONS, labelOf } from '@/constants/catalog';
import { exportCsv } from '@/utils/csv';
import { formatDate, formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { toast } from '@/store/toastStore';
import { Avatar, Button, EmptyState, PageHeader, StatusBadge } from '@/components/common';
import { DateInput, FilterSelect, SearchInput } from '@/components/forms';
import { BulkButton, ClearFiltersButton, DataTable, type Column } from '@/components/tables';
import { MOVEMENT_CSV, STOCK_ACTION } from '@/components/inventory/inventoryMeta';

const ACTION_OPTIONS = (Object.keys(STOCK_ACTION) as StockAction[]).map((a) => ({ value: a, label: STOCK_ACTION[a].label }));
const endOfDay = (v: string) => (v ? new Date(`${v}T23:59:59.999`).toISOString() : undefined);
const startOfDay = (v: string) => (v ? new Date(`${v}T00:00:00`).toISOString() : undefined);

export default function StockMovementsPage() {
  const navigate = useNavigate();
  const canExport = usePermission('inventory:export');
  const { filters, setFilter, resetFilters, activeCount } = useUrlFilters({ search: '', from: '', to: '', product: '', action: '', admin: '', variant: '' });
  const [search, setSearch] = useState(filters.search);
  const debounced = useDebounce(search, 250);
  useEffect(() => {
    if (debounced !== filters.search) setFilter('search', debounced);
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const query: MovementFilters = {
    search: filters.search || undefined,
    action: (filters.action as StockAction) || undefined,
    adminId: filters.admin || undefined,
    productId: filters.product || undefined,
    variantId: filters.variant || undefined,
    from: startOfDay(filters.from),
    to: endOfDay(filters.to),
  };
  const { data, loading, error, reload } = useAsync(() => inventoryService.getMovements(query), [JSON.stringify(query)]);
  // Unfiltered list feeds the product options and deep-link chip labels.
  const all = useAsync(() => inventoryService.getMovements(), []);
  const admins = useAsync(() => settingsService.getAdminUsers(), []);

  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    (all.data ?? []).forEach((m) => map.set(m.productId, m.productName));
    return [...map].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [all.data]);
  const adminOptions = useMemo(() => {
    const map = new Map<string, string>();
    (admins.data ?? []).forEach((a) => map.set(a.id, a.name));
    (all.data ?? []).forEach((m) => map.set(m.adminId, m.adminName));
    return [...map].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [admins.data, all.data]);

  const variantRef = filters.variant ? (all.data ?? []).find((m) => m.variantId === filters.variant) : undefined;
  const dateError = filters.from && filters.to && filters.from > filters.to ? 'Start date is after end date.' : undefined;

  const doExport = (rows: StockMovement[], name = 'stock-movements') => {
    if (!rows.length) return toast.info('Nothing to export.');
    exportCsv(name, rows, MOVEMENT_CSV);
    toast.success(`Exported ${rows.length} movement${rows.length === 1 ? '' : 's'}.`);
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
      sortValue: (m) => m.productName,
      cell: (m) => (
        <div className="min-w-[180px]">
          <Link to={`/products/${m.productId}`} className="font-medium text-zinc-900 hover:underline">
            {m.productName}
          </Link>
          <div className="font-mono text-xs text-zinc-500">{m.sku}</div>
        </div>
      ),
    },
    { id: 'variant', header: 'Variant', sortValue: (m) => m.variantLabel, cell: (m) => <span className="whitespace-nowrap text-zinc-700">{m.variantLabel}</span> },
    { id: 'action', header: 'Action', sortValue: (m) => m.action, mobile: 'aside', cell: (m) => <StatusBadge map={STOCK_ACTION} value={m.action} dot={false} /> },
    {
      id: 'quantity',
      header: 'Quantity',
      align: 'right',
      sortValue: (m) => m.quantity,
      mobile: 'aside',
      cell: (m) => <span className={cn('font-semibold tabular', m.quantity > 0 ? 'text-emerald-700' : m.quantity < 0 ? 'text-red-600' : 'text-zinc-500')}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity < 0 ? `−${Math.abs(m.quantity)}` : '0'}</span>,
    },
    { id: 'previous', header: 'Previous', label: 'Previous stock', align: 'right', sortValue: (m) => m.previousStock, cell: (m) => <span className="tabular text-zinc-500">{m.previousStock}</span> },
    { id: 'new', header: 'New stock', align: 'right', sortValue: (m) => m.newStock, cell: (m) => <span className="font-medium tabular text-zinc-900">{m.newStock}</span> },
    {
      id: 'reason',
      header: 'Reason',
      sortValue: (m) => m.reason,
      cell: (m) => (
        <div className="max-w-[220px]">
          <div className="text-zinc-800">{labelOf(STOCK_REASONS, m.reason)}</div>
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
      sortValue: (m) => m.adminName,
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
        description="Audit trail of every stock change — manual adjustments, sales and returns."
        backTo="/inventory"
        backLabel="Inventory"
        actions={
          canExport && (
            <Button variant="secondary" icon={Download} onClick={() => doExport(data ?? [])} disabled={loading}>
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
              Variant: {variantRef ? `${variantRef.productName} · ${variantRef.variantLabel}` : filters.variant}
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
        pageSize={25}
        initialSort={{ id: 'date', dir: 'desc' }}
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
            <SearchInput value={search} onChange={setSearch} placeholder="Search product, SKU or note…" className="w-full sm:w-64" />
            <FilterSelect label="Product" value={filters.product} onChange={(v) => setFilter('product', v)} options={productOptions} className="max-w-[240px]" />
            <FilterSelect label="Action" value={filters.action} onChange={(v) => setFilter('action', v)} options={ACTION_OPTIONS} />
            <FilterSelect label="Admin" value={filters.admin} onChange={(v) => setFilter('admin', v)} options={adminOptions} />
            <div className="flex items-center gap-1.5">
              <DateInput aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} inputClassName="h-8 w-[140px] text-[0.8125rem]" />
              <span className="text-xs text-zinc-400">to</span>
              <DateInput aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} inputClassName="h-8 w-[140px] text-[0.8125rem]" />
            </div>
            {dateError && <span role="alert" className="text-xs font-medium text-red-600">{dateError}</span>}
            <ClearFiltersButton count={activeCount} onClear={clearAll} />
          </>
        }
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
