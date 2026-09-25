import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, History, Minus, PackageSearch, Plus, SlidersHorizontal } from 'lucide-react';
import type { InventoryItem, StockStatus } from '@/types';
import { inventoryService } from '@/services/inventoryService';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/misc';
import { usePermission } from '@/hooks/usePermission';
import { PRODUCT_TYPES, labelOf } from '@/constants/catalog';
import { STOCK_STATUS } from '@/constants/status';
import { exportCsv } from '@/utils/csv';
import { cn } from '@/utils/cn';
import { toast } from '@/store/toastStore';
import { Button, ColorDot, EmptyState, Menu, PageHeader, ProductThumb, StatusBadge, Tabs } from '@/components/common';
import { FilterSelect, SearchInput } from '@/components/forms';
import { BulkButton, ClearFiltersButton, DataTable, type Column } from '@/components/tables';
import { InventorySummary } from '@/components/inventory/InventorySummary';
import { StockAdjustmentDrawer } from '@/components/inventory/StockAdjustmentDrawer';
import { StockBar } from '@/components/inventory/StockBar';
import { VariantPickerModal } from '@/components/inventory/VariantPickerModal';
import { INVENTORY_CSV, type AdjustMode } from '@/components/inventory/inventoryMeta';

type StatusTab = StockStatus | 'all';
const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
];

export default function InventoryPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { filters, setFilter, resetFilters, activeCount } = useUrlFilters({ status: '', type: '', search: '' });
  const [search, setSearch] = useState(filters.search);
  const debounced = useDebounce(search, 250);
  const canEdit = usePermission('inventory:edit');
  const canExport = usePermission('inventory:export');

  // Full inventory is loaded once; filtering is local so saved rows update in place without a reload.
  const { data, loading, error, reload, setData } = useAsync(() => inventoryService.getInventory(), []);
  const [adjust, setAdjust] = useState<{ item: InventoryItem; mode: AdjustMode } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (debounced !== filters.search) setFilter('search', debounced);
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (filters.search !== search && filters.search === '') setSearch('');
  }, [filters.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // ?adjust=1 opens the variant picker; ?adjust=<variantId> opens the drawer directly.
  const adjustParam = params.get('adjust');
  useEffect(() => {
    if (!adjustParam) return;
    if (adjustParam === '1') {
      setPickerOpen(true);
      clearAdjustParam();
      return;
    }
    if (!data) return;
    const hit = data.find((i) => i.variantId === adjustParam || i.sku === adjustParam);
    if (hit) setAdjust({ item: hit, mode: 'add' });
    else toast.warning('Variant not found.', { description: 'It may have been archived or removed.' });
    clearAdjustParam();
  }, [adjustParam, data]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearAdjustParam() {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('adjust');
        return next;
      },
      { replace: true },
    );
  }

  const status = (filters.status in STOCK_STATUS ? filters.status : 'all') as StatusTab;
  const base = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return (data ?? []).filter((i) => (!filters.type || i.productType === filters.type) && (!term || [i.productName, i.sku, i.variantLabel].some((s) => s.toLowerCase().includes(term))));
  }, [data, filters.type, filters.search]);
  const rows = useMemo(() => (status === 'all' ? base : base.filter((i) => i.status === status)), [base, status]);
  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = { all: base.length, in_stock: 0, low_stock: 0, out_of_stock: 0 };
    base.forEach((i) => c[i.status]++);
    return c;
  }, [base]);

  const onSaved = (updated: InventoryItem) => setData((prev) => prev?.map((i) => (i.variantId === updated.variantId ? updated : i)));
  const open = (item: InventoryItem, mode: AdjustMode) => setAdjust({ item, mode });
  const exportRows = (list: InventoryItem[], label = 'inventory') => {
    if (!list.length) return toast.info('Nothing to export.');
    exportCsv(label, list, INVENTORY_CSV);
    toast.success(`Exported ${list.length} variant${list.length === 1 ? '' : 's'}.`);
  };

  const columns: Column<InventoryItem>[] = [
    {
      id: 'product',
      header: 'Product',
      mobile: 'title',
      hideable: false,
      sortValue: (r) => r.productName,
      cell: (r) => (
        <div className="flex min-w-[200px] items-center gap-3">
          <ProductThumb src={r.productImage} alt={r.productName} size={40} />
          <div className="min-w-0">
            <Link to={`/products/${r.productId}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-zinc-900 hover:underline">
              {r.productName}
            </Link>
            <span className="text-xs text-zinc-500">{labelOf(PRODUCT_TYPES, r.productType)}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'variant',
      header: 'Variant',
      mobile: 'subtitle',
      sortValue: (r) => r.variantLabel,
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-zinc-800">
          <ColorDot hex={r.colorHex} /> {r.color} / {r.size}
        </span>
      ),
    },
    { id: 'sku', header: 'SKU', sortValue: (r) => r.sku, cell: (r) => <span className="whitespace-nowrap font-mono text-xs text-zinc-600">{r.sku}</span> },
    {
      id: 'stock',
      header: 'Current stock',
      label: 'Current stock',
      align: 'right',
      sortValue: (r) => r.stock,
      cell: (r) => (
        <div className="flex items-center justify-end gap-2.5">
          <StockBar item={r} className="hidden xl:block" />
          <span className={cn('w-8 text-right font-semibold tabular', r.status === 'out_of_stock' ? 'text-red-600' : r.status === 'low_stock' ? 'text-amber-700' : 'text-zinc-900')}>{r.stock}</span>
        </div>
      ),
    },
    { id: 'reserved', header: 'Reserved', align: 'right', sortValue: (r) => r.reserved, cell: (r) => <span className="tabular text-zinc-600">{r.reserved}</span> },
    { id: 'available', header: 'Available', align: 'right', sortValue: (r) => r.available, cell: (r) => <span className="font-medium tabular text-zinc-900">{r.available}</span> },
    { id: 'threshold', header: 'Threshold', align: 'right', sortValue: (r) => r.threshold, cell: (r) => <span className="tabular text-zinc-500">{r.threshold}</span> },
    { id: 'status', header: 'Status', mobile: 'aside', sortValue: (r) => ['out_of_stock', 'low_stock', 'in_stock'].indexOf(r.status), cell: (r) => <StatusBadge map={STOCK_STATUS} value={r.status} /> },
  ];

  const hasFilters = Boolean(filters.search || filters.type || filters.status);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Variant-level stock across the catalogue. Adjustments are logged with a reason and the admin who made them."
        actions={
          <>
            <Button variant="secondary" icon={History} onClick={() => navigate('/inventory/movements')}>
              Movement history
            </Button>
            {canExport && (
              <Button variant="secondary" icon={Download} onClick={() => exportRows(rows)} disabled={loading}>
                Export CSV
              </Button>
            )}
            {canEdit && (
              <Button variant="primary" icon={SlidersHorizontal} onClick={() => setPickerOpen(true)}>
                Adjust stock
              </Button>
            )}
          </>
        }
      />

      <InventorySummary items={data} loading={loading} />

      <Tabs ariaLabel="Stock status" className="mb-4" items={STATUS_TABS.map((t) => ({ ...t, count: data ? counts[t.value] : undefined }))} value={status} onChange={(v) => setFilter('status', v === 'all' ? '' : v)} />

      <DataTable
        caption="Inventory by variant"
        storageKey="inventory"
        data={rows}
        columns={columns}
        getRowId={(r) => r.variantId}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        selectable={canExport}
        pageSize={25}
        initialSort={{ id: 'status', dir: 'asc' }}
        rowClassName={(r) => (r.status === 'out_of_stock' ? 'bg-red-50/30' : undefined)}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Search product, SKU or variant…" className="w-full sm:w-72" />
            <FilterSelect label="Type" value={filters.type} onChange={(v) => setFilter('type', v)} options={PRODUCT_TYPES} />
            <ClearFiltersButton
              count={activeCount}
              onClear={() => {
                resetFilters();
                setSearch('');
              }}
            />
          </>
        }
        toolbarRight={<span className="hidden text-xs text-zinc-500 tabular sm:inline">{rows.length} variants</span>}
        bulkActions={(ids, clear) => (
          <BulkButton
            icon={Download}
            onClick={() => {
              exportRows(rows.filter((r) => ids.includes(r.variantId)), 'inventory-selection');
              clear();
            }}
          >
            Export selected
          </BulkButton>
        )}
        rowActions={(r) => (
          <Menu
            label={`Actions for ${r.sku}`}
            width={220}
            items={[
              { label: 'Adjust stock', icon: SlidersHorizontal, onSelect: () => open(r, 'set'), hidden: !canEdit },
              { label: 'Add stock', icon: Plus, onSelect: () => open(r, 'add'), hidden: !canEdit },
              { label: 'Remove stock', icon: Minus, onSelect: () => open(r, 'remove'), hidden: !canEdit, disabled: r.stock === 0 },
              { label: 'View movement history', icon: History, onSelect: () => navigate(`/inventory/movements?variant=${encodeURIComponent(r.variantId)}`), separator: canEdit },
            ]}
          />
        )}
        empty={
          hasFilters ? (
            <EmptyState
              icon={PackageSearch}
              title="No variants match these filters"
              description="Try a different search, product type or stock status."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    resetFilters();
                    setSearch('');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon={PackageSearch} title="No inventory yet" description="Variants appear here once products are created with sizes and colours." action={<Button size="sm" variant="primary" onClick={() => navigate('/products/new')}>Add product</Button>} />
          )
        }
      />

      <VariantPickerModal
        open={pickerOpen}
        items={data}
        loading={loading}
        onClose={() => setPickerOpen(false)}
        onSelect={(item) => {
          setPickerOpen(false);
          setAdjust({ item, mode: 'add' });
        }}
      />
      <StockAdjustmentDrawer open={Boolean(adjust)} item={adjust?.item ?? null} initialMode={adjust?.mode} onClose={() => setAdjust(null)} onSaved={onSaved} />
    </>
  );
}
