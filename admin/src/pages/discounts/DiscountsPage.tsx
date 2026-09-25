import { useState } from 'react';
import { CalendarClock, Pencil, Plus, Power, PowerOff, Sparkles, Tags, Trash2 } from 'lucide-react';
import type { Discount, PromotionStatus } from '@/types';
import { Badge, Button, EmptyState, Menu, PageHeader, StatusBadge, Tabs } from '@/components/common';
import { FilterSelect, SearchInput } from '@/components/forms';
import { DataTable, type Column, type SortState } from '@/components/tables';
import { StatStrip } from '@/components/marketing/MarketingParts';
import { DiscountFormDrawer, describeTargets } from '@/components/marketing/DiscountFormDrawer';
import { useMarketingCatalog } from '@/components/marketing/useMarketingData';
import { discountLabel, errorMessage } from '@/components/marketing/utils';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/misc';
import { usePermission } from '@/hooks/usePermission';
import { discountService, promotionStatus, type DiscountSort } from '@/services/discountService';
import { PROMOTION_STATUS } from '@/constants/status';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { formatDate } from '@/utils/format';

type Tab = 'all' | PromotionStatus;
const TABS: Tab[] = ['all', 'active', 'scheduled', 'expired', 'disabled'];
const APPLIES_LABEL: Record<Discount['appliesTo'], string> = { all: 'All products', categories: 'Categories', products: 'Products', brands: 'Brands' };
const APPLIES_OPTIONS = (Object.keys(APPLIES_LABEL) as Discount['appliesTo'][]).map((v) => ({ value: v, label: APPLIES_LABEL[v] }));
const SORT_KEYS: Record<string, DiscountSort> = { name: 'name', value: 'value', start: 'starts_at', end: 'ends_at', created: 'created_at' };

export default function DiscountsPage() {
  const { filters, setFilter, setFilters, resetFilters } = useUrlFilters({ status: 'all', search: '', applies: '', page: '1', size: '20', sort: 'created', dir: 'desc' });
  const search = useDebounce(filters.search, 300);
  const tab = (TABS.includes(filters.status as Tab) ? filters.status : 'all') as Tab;
  const applies = (APPLIES_LABEL[filters.applies as Discount['appliesTo']] ? filters.applies : '') as Discount['appliesTo'] | '';
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Number(filters.size) || 20;
  const sort: SortState = { id: SORT_KEYS[filters.sort] ? filters.sort : 'created', dir: filters.dir === 'asc' ? 'asc' : 'desc' };

  const { data, loading, error, reload } = useAsync(
    () => discountService.getDiscounts({ page, pageSize, search, status: tab === 'all' ? undefined : tab, appliesTo: applies || undefined, sort: SORT_KEYS[sort.id], order: sort.dir }),
    [page, pageSize, search, tab, applies, sort.id, sort.dir],
  );
  const countsState = useAsync(() => discountService.getDiscountCounts(), []);
  const counts = countsState.data;
  const catalog = useMarketingCatalog();
  const [drawer, setDrawer] = useState<{ discount?: Discount } | null>(null);
  const canCreate = usePermission('discounts:create');
  const canEdit = usePermission('discounts:edit');
  const canDelete = usePermission('discounts:delete');

  const rows = data?.items ?? [];
  const refresh = async () => {
    await Promise.all([reload(true), countsState.reload(true)]);
  };

  const toggle = async (d: Discount) => {
    try {
      const saved = await discountService.setDiscountEnabled(d.id, !d.enabled);
      toast.success(saved.enabled ? 'Discount enabled.' : 'Discount disabled.', { description: saved.name });
      await refresh();
    } catch (e) {
      toast.error('Couldn’t update discount.', { description: errorMessage(e) });
    }
  };

  const remove = async (d: Discount) => {
    if (!(await confirm({ title: `Delete “${d.name}”?`, description: 'Prices return to normal immediately. This action cannot be undone.', confirmLabel: 'Delete discount' }))) return;
    try {
      await discountService.deleteDiscount(d.id);
      toast.success('Discount deleted.', { description: d.name });
      if (rows.length === 1 && page > 1) {
        setFilter('page', String(page - 1));
        void countsState.reload(true);
      } else await refresh();
    } catch (e) {
      toast.error('Couldn’t delete discount.', { description: errorMessage(e) });
    }
  };

  const columns: Column<Discount>[] = [
    {
      id: 'name',
      header: 'Discount',
      mobile: 'title',
      hideable: false,
      sortValue: (d) => d.name,
      cell: (d) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-volt">
            <Sparkles size={15} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium text-zinc-950">{d.name}</div>
            <div className="text-xs text-zinc-500">{d.type === 'percentage' ? 'Percentage' : 'Fixed amount'} · automatic</div>
          </div>
        </div>
      ),
    },
    { id: 'value', header: 'Value', align: 'right', mobile: 'aside', sortValue: (d) => d.value, cell: (d) => <span className="font-semibold tabular text-zinc-950">{discountLabel(d.type, d.value)}</span> },
    {
      id: 'applies',
      header: 'Applies to',
      cell: (d) => (
        <div className="min-w-0">
          <Badge tone={d.appliesTo === 'all' ? 'brand' : 'neutral'}>{APPLIES_LABEL[d.appliesTo]}</Badge>
          {d.appliesTo !== 'all' && <div className="mt-1 max-w-[220px] truncate text-xs text-zinc-500">{describeTargets(d, catalog)}</div>}
        </div>
      ),
    },
    { id: 'start', header: 'Start', sortValue: (d) => d.startsAt, cell: (d) => <span className="tabular text-zinc-700">{formatDate(d.startsAt)}</span> },
    { id: 'end', header: 'End', sortValue: (d) => d.endsAt ?? '9999', cell: (d) => <span className="tabular text-zinc-700">{d.endsAt ? formatDate(d.endsAt) : 'No end'}</span> },
    { id: 'created', header: 'Created', defaultHidden: true, sortValue: (d) => d.createdAt, cell: (d) => <span className="tabular text-zinc-700">{formatDate(d.createdAt)}</span> },
    { id: 'status', header: 'Status', mobile: 'subtitle', cell: (d) => <StatusBadge map={PROMOTION_STATUS} value={d.status ?? promotionStatus(d)} /> },
  ];

  const create = () => setDrawer({});

  return (
    <div>
      <PageHeader
        title="Automatic discounts"
        documentTitle="Discounts"
        description="Code-less price reductions applied at checkout to the whole catalogue, categories, brands or specific products."
        actions={canCreate && <Button variant="primary" icon={Plus} onClick={create}>Create discount</Button>}
      />

      <StatStrip
        loading={countsState.loading && !counts}
        items={[
          { label: 'Running now', value: counts?.active ?? 0, icon: Sparkles, accent: true },
          { label: 'Scheduled', value: counts?.scheduled ?? 0, icon: CalendarClock },
          { label: 'Disabled or expired', value: (counts?.disabled ?? 0) + (counts?.expired ?? 0), icon: Tags },
        ]}
      />

      <Tabs
        ariaLabel="Filter discounts by status"
        className="mb-4"
        value={tab}
        onChange={(v) => setFilters({ status: v, page: '1' })}
        items={TABS.map((t) => ({ value: t, label: t === 'all' ? 'All discounts' : PROMOTION_STATUS[t].label, count: counts?.[t] }))}
      />

      <DataTable
        caption="Automatic discounts"
        storageKey="discounts"
        data={rows}
        columns={columns}
        getRowId={(d) => d.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        sort={sort}
        onSortChange={(s) => setFilters({ sort: s.id, dir: s.dir, page: '1' })}
        serverPagination={{
          page,
          pageSize,
          total: data?.total ?? 0,
          onPageChange: (p) => setFilter('page', String(p)),
          onPageSizeChange: (s) => setFilters({ size: String(s), page: '1' }),
        }}
        onRowClick={canEdit ? (d) => setDrawer({ discount: d }) : undefined}
        toolbar={
          <div className="flex w-full flex-wrap items-center gap-2">
            <SearchInput value={filters.search} onChange={(v) => setFilters({ search: v, page: '1' })} placeholder="Search discounts…" className="w-full sm:w-72" label="Search discounts" />
            <FilterSelect label="Applies to" value={applies} onChange={(v) => setFilters({ applies: v, page: '1' })} options={APPLIES_OPTIONS} />
          </div>
        }
        rowActions={(d) => (
          <Menu
            label={`Actions for ${d.name}`}
            items={[
              { label: 'Edit', icon: Pencil, onSelect: () => setDrawer({ discount: d }), hidden: !canEdit },
              { label: d.enabled ? 'Disable' : 'Enable', icon: d.enabled ? PowerOff : Power, onSelect: () => void toggle(d), hidden: !canEdit },
              { label: 'Delete', icon: Trash2, danger: true, separator: true, onSelect: () => void remove(d), hidden: !canDelete },
            ]}
          />
        )}
        empty={
          tab !== 'all' || filters.search || applies ? (
            <EmptyState icon={Sparkles} title="No discounts match" description="Try another status, scope or search term." action={<Button size="sm" onClick={resetFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={Sparkles} title="No automatic discounts" description="Mark down a category, brand or selection of products without a code." action={canCreate && <Button variant="primary" size="sm" icon={Plus} onClick={create}>Create discount</Button>} />
          )
        }
      />

      <DiscountFormDrawer
        open={Boolean(drawer)}
        discount={drawer?.discount}
        catalog={catalog}
        onClose={() => setDrawer(null)}
        onSaved={() => {
          setDrawer(null);
          void refresh();
        }}
      />
    </div>
  );
}
