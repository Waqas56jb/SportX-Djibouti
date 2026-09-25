import { useMemo, useState } from 'react';
import { CalendarClock, Pencil, Plus, Power, PowerOff, Sparkles, Tags, Trash2 } from 'lucide-react';
import type { Discount, PromotionStatus } from '@/types';
import { Badge, Button, EmptyState, Menu, PageHeader, StatusBadge, Tabs } from '@/components/common';
import { SearchInput } from '@/components/forms';
import { DataTable, type Column } from '@/components/tables';
import { StatStrip } from '@/components/marketing/MarketingParts';
import { DiscountFormDrawer, describeTargets } from '@/components/marketing/DiscountFormDrawer';
import { useMarketingCatalog } from '@/components/marketing/useMarketingData';
import { discountLabel, errorMessage } from '@/components/marketing/utils';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePermission } from '@/hooks/usePermission';
import { discountService, promotionStatus } from '@/services/discountService';
import { PROMOTION_STATUS } from '@/constants/status';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { formatDate } from '@/utils/format';

type Tab = 'all' | PromotionStatus;
const TABS: Tab[] = ['all', 'active', 'scheduled', 'expired', 'disabled'];
const APPLIES_LABEL: Record<Discount['appliesTo'], string> = { all: 'All products', categories: 'Categories', products: 'Products', brands: 'Brands' };

type Row = { d: Discount; status: PromotionStatus };

export default function DiscountsPage() {
  const { filters, setFilter, resetFilters } = useUrlFilters({ status: 'all', search: '' });
  const tab = (TABS.includes(filters.status as Tab) ? filters.status : 'all') as Tab;
  const { data, loading, error, reload, setData } = useAsync(() => discountService.getDiscounts(), []);
  const catalog = useMarketingCatalog();
  const [drawer, setDrawer] = useState<{ discount?: Discount } | null>(null);
  const canCreate = usePermission('discounts:create');
  const canEdit = usePermission('discounts:edit');
  const canDelete = usePermission('discounts:delete');

  const withStatus = useMemo<Row[]>(() => (data ?? []).map((d) => ({ d, status: promotionStatus(d) })), [data]);
  const counts = useMemo(() => {
    const out: Record<Tab, number> = { all: withStatus.length, active: 0, scheduled: 0, expired: 0, disabled: 0 };
    withStatus.forEach((x) => out[x.status]++);
    return out;
  }, [withStatus]);
  const rows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return withStatus.filter((x) => (tab === 'all' || x.status === tab) && (!q || x.d.name.toLowerCase().includes(q)));
  }, [withStatus, tab, filters.search]);

  const replace = (d: Discount) => setData((list) => list?.map((x) => (x.id === d.id ? d : x)));

  const toggle = async (d: Discount) => {
    try {
      const saved = await discountService.setDiscountEnabled(d.id, !d.enabled);
      replace(saved);
      toast.success(saved.enabled ? 'Discount enabled.' : 'Discount disabled.', { description: saved.name });
    } catch (e) {
      toast.error('Couldn’t update discount.', { description: errorMessage(e) });
    }
  };

  const remove = async (d: Discount) => {
    if (!(await confirm({ title: `Delete “${d.name}”?`, description: 'Prices return to normal immediately. This action cannot be undone.', confirmLabel: 'Delete discount' }))) return;
    try {
      await discountService.deleteDiscount(d.id);
      setData((list) => list?.filter((x) => x.id !== d.id));
      toast.success('Discount deleted.', { description: d.name });
    } catch (e) {
      toast.error('Couldn’t delete discount.', { description: errorMessage(e) });
    }
  };

  const columns: Column<Row>[] = [
    {
      id: 'name',
      header: 'Discount',
      mobile: 'title',
      hideable: false,
      sortValue: (r) => r.d.name,
      cell: ({ d }) => (
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
    { id: 'value', header: 'Value', align: 'right', mobile: 'aside', sortValue: (r) => r.d.value, cell: ({ d }) => <span className="font-semibold tabular text-zinc-950">{discountLabel(d.type, d.value)}</span> },
    {
      id: 'applies',
      header: 'Applies to',
      sortValue: (r) => r.d.appliesTo,
      cell: ({ d }) => (
        <div className="min-w-0">
          <Badge tone={d.appliesTo === 'all' ? 'brand' : 'neutral'}>{APPLIES_LABEL[d.appliesTo]}</Badge>
          {d.appliesTo !== 'all' && <div className="mt-1 max-w-[220px] truncate text-xs text-zinc-500">{describeTargets(d, catalog)}</div>}
        </div>
      ),
    },
    { id: 'start', header: 'Start', sortValue: (r) => r.d.startsAt, cell: ({ d }) => <span className="tabular text-zinc-700">{formatDate(d.startsAt)}</span> },
    { id: 'end', header: 'End', sortValue: (r) => r.d.endsAt ?? '9999', cell: ({ d }) => <span className="tabular text-zinc-700">{d.endsAt ? formatDate(d.endsAt) : 'No end'}</span> },
    { id: 'status', header: 'Status', mobile: 'subtitle', sortValue: (r) => r.status, cell: (r) => <StatusBadge map={PROMOTION_STATUS} value={r.status} /> },
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
        loading={loading}
        items={[
          { label: 'Running now', value: counts.active, icon: Sparkles, accent: true },
          { label: 'Scheduled', value: counts.scheduled, icon: CalendarClock },
          { label: 'Disabled or expired', value: counts.disabled + counts.expired, icon: Tags },
        ]}
      />

      <Tabs
        ariaLabel="Filter discounts by status"
        className="mb-4"
        value={tab}
        onChange={(v) => setFilter('status', v)}
        items={TABS.map((t) => ({ value: t, label: t === 'all' ? 'All discounts' : PROMOTION_STATUS[t].label, count: loading ? undefined : counts[t] }))}
      />

      <DataTable
        caption="Automatic discounts"
        storageKey="discounts"
        data={rows}
        columns={columns}
        getRowId={(r) => r.d.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        initialSort={{ id: 'start', dir: 'desc' }}
        onRowClick={canEdit ? (r) => setDrawer({ discount: r.d }) : undefined}
        toolbar={<SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search discounts…" className="w-full sm:w-72" label="Search discounts" />}
        rowActions={({ d }) => (
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
          tab !== 'all' || filters.search ? (
            <EmptyState icon={Sparkles} title="No discounts match" description="Try another status or search term." action={<Button size="sm" onClick={resetFilters}>Clear filters</Button>} />
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
        onSaved={(d, created) => {
          setDrawer(null);
          if (created) setData((list) => [d, ...(list ?? [])]);
          else replace(d);
        }}
      />
    </div>
  );
}
