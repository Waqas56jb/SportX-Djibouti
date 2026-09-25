import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Copy, History, Pencil, Plus, Power, PowerOff, Ticket, TicketCheck, TicketX, Trash2 } from 'lucide-react';
import type { Coupon, PromotionStatus } from '@/types';
import { Badge, Button, EmptyState, Menu, PageHeader, StatusBadge, Tabs } from '@/components/common';
import { SearchInput } from '@/components/forms';
import { DataTable, type Column, type SortState } from '@/components/tables';
import { CopyCode, StatStrip, UsageMeter } from '@/components/marketing/MarketingParts';
import { CouponFormDrawer, type CouponDrawerState } from '@/components/marketing/CouponFormDrawer';
import { CouponUsagesDrawer } from '@/components/marketing/CouponUsagesDrawer';
import { useMarketingCatalog } from '@/components/marketing/useMarketingData';
import { discountLabel, errorMessage } from '@/components/marketing/utils';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/misc';
import { usePermission } from '@/hooks/usePermission';
import { discountService, promotionStatus, type CouponSort } from '@/services/discountService';
import { PROMOTION_STATUS } from '@/constants/status';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { formatDate, formatMoney, formatNumber } from '@/utils/format';

type Tab = 'all' | PromotionStatus;
const TABS: Tab[] = ['all', 'active', 'scheduled', 'expired', 'disabled'];
/** Table column id → server sort key. */
const SORT_KEYS: Record<string, CouponSort> = { code: 'code', value: 'value', usage: 'usage_count', start: 'starts_at', end: 'ends_at', created: 'created_at' };
const EMPTY_COUNTS: Record<Tab, number> = { all: 0, active: 0, scheduled: 0, expired: 0, disabled: 0 };

export default function CouponsPage() {
  const { filters, setFilter, setFilters, resetFilters } = useUrlFilters({ status: 'all', search: '', page: '1', size: '20', sort: 'created', dir: 'desc' });
  const [params, setParams] = useSearchParams();
  const search = useDebounce(filters.search, 300);
  const tab = (TABS.includes(filters.status as Tab) ? filters.status : 'all') as Tab;
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Number(filters.size) || 20;
  const sort: SortState = { id: SORT_KEYS[filters.sort] ? filters.sort : 'created', dir: filters.dir === 'asc' ? 'asc' : 'desc' };

  const { data, loading, error, reload } = useAsync(
    () => discountService.getCoupons({ page, pageSize, search, status: tab === 'all' ? undefined : tab, sort: SORT_KEYS[sort.id], order: sort.dir }),
    [page, pageSize, search, tab, sort.id, sort.dir],
  );
  const catalog = useMarketingCatalog();
  const [drawer, setDrawer] = useState<CouponDrawerState | null>(null);
  const [usagesFor, setUsagesFor] = useState<Coupon | null>(null);
  const canCreate = usePermission('discounts:create');
  const canEdit = usePermission('discounts:edit');
  const canDelete = usePermission('discounts:delete');

  useEffect(() => {
    if (params.get('new') !== '1') return;
    if (canCreate) setDrawer({ mode: 'create' });
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('new');
        return next;
      },
      { replace: true },
    );
  }, [params, setParams, canCreate]);

  const counts = (data?.counts ?? EMPTY_COUNTS) as Record<Tab, number>;
  const rows = data?.items ?? [];
  const statusOf = (c: Coupon): PromotionStatus => c.status ?? promotionStatus(c);

  const toggle = async (c: Coupon) => {
    try {
      const saved = await discountService.setCouponEnabled(c.id, !c.enabled);
      toast.success(saved.enabled ? 'Coupon enabled.' : 'Coupon disabled.', { description: saved.code });
      await reload(true);
    } catch (e) {
      toast.error('Couldn’t update coupon.', { description: errorMessage(e) });
    }
  };

  const remove = async (c: Coupon) => {
    const ok = await confirm({
      title: `Delete ${c.code}?`,
      description: c.usageCount ? `This coupon has been redeemed ${formatNumber(c.usageCount)} times. Past orders keep their discount and history, but the code stops working immediately.` : 'The code will stop working immediately. This action cannot be undone.',
      confirmLabel: 'Delete coupon',
    });
    if (!ok) return;
    try {
      await discountService.deleteCoupon(c.id);
      toast.success('Coupon deleted.', { description: c.code });
      if (rows.length === 1 && page > 1) setFilter('page', String(page - 1));
      else await reload(true);
    } catch (e) {
      toast.error('Couldn’t delete coupon.', { description: errorMessage(e) });
    }
  };

  const onSaved = () => {
    setDrawer(null);
    void reload(true);
  };

  const columns: Column<Coupon>[] = [
    {
      id: 'code',
      header: 'Code',
      mobile: 'title',
      hideable: false,
      sortValue: (c) => c.code,
      cell: (c) => (
        <div className="min-w-0">
          <CopyCode code={c.code} />
          {c.description && <div className="mt-1 max-w-[240px] truncate text-xs text-zinc-500">{c.description}</div>}
        </div>
      ),
    },
    { id: 'type', header: 'Type', cell: (c) => <Badge tone="neutral">{c.type === 'percentage' ? 'Percentage' : 'Fixed amount'}</Badge> },
    { id: 'value', header: 'Value', align: 'right', mobile: 'aside', sortValue: (c) => c.value, cell: (c) => <span className="font-semibold tabular text-zinc-950">{discountLabel(c.type, c.value)}</span> },
    { id: 'usage', header: 'Usage', sortValue: (c) => c.usageCount, cell: (c) => <UsageMeter count={c.usageCount} limit={c.usageLimit} /> },
    { id: 'discounted', header: 'Discounted', label: 'Total discounted', align: 'right', defaultHidden: true, cell: (c) => <span className="tabular text-zinc-700">{formatMoney(c.discountTotal ?? 0)}</span> },
    { id: 'limit', header: 'Per customer', label: 'Per-customer limit', align: 'right', cell: (c) => <span className="tabular text-zinc-700">{c.perCustomerLimit ?? '—'}</span> },
    { id: 'min', header: 'Min. order', label: 'Minimum order', align: 'right', cell: (c) => <span className="tabular text-zinc-700">{c.minOrder ? formatMoney(c.minOrder) : '—'}</span> },
    { id: 'start', header: 'Start', sortValue: (c) => c.startsAt, cell: (c) => <span className="tabular text-zinc-700">{formatDate(c.startsAt)}</span> },
    { id: 'end', header: 'End', sortValue: (c) => c.endsAt ?? '9999', cell: (c) => <span className="tabular text-zinc-700">{c.endsAt ? formatDate(c.endsAt) : 'No end'}</span> },
    { id: 'created', header: 'Created', defaultHidden: true, sortValue: (c) => c.createdAt, cell: (c) => <span className="tabular text-zinc-700">{formatDate(c.createdAt)}</span> },
    { id: 'status', header: 'Status', mobile: 'subtitle', cell: (c) => <StatusBadge map={PROMOTION_STATUS} value={statusOf(c)} /> },
  ];

  const filtered = tab !== 'all' || Boolean(filters.search);

  return (
    <div>
      <PageHeader
        title="Coupons"
        description="Promo codes customers enter at checkout. Track redemptions and control limits, schedule and eligibility."
        actions={
          canCreate && (
            <Button variant="primary" icon={Plus} onClick={() => setDrawer({ mode: 'create' })}>
              Create coupon
            </Button>
          )
        }
      />

      <StatStrip
        loading={loading && !data}
        items={[
          { label: 'Active coupons', value: counts.active, icon: TicketCheck, accent: true, hint: 'Redeemable right now' },
          { label: 'Scheduled', value: counts.scheduled, icon: CalendarClock, hint: 'Start in the future' },
          { label: 'Expired or disabled', value: counts.expired + counts.disabled, icon: TicketX, hint: `${formatNumber(counts.all)} coupons in total` },
        ]}
      />

      <Tabs
        ariaLabel="Filter coupons by status"
        className="mb-4"
        value={tab}
        onChange={(v) => setFilters({ status: v, page: '1' })}
        items={TABS.map((t) => ({ value: t, label: t === 'all' ? 'All coupons' : PROMOTION_STATUS[t].label, count: data ? counts[t] : undefined }))}
      />

      <DataTable
        caption="Coupons"
        storageKey="coupons"
        data={rows}
        columns={columns}
        getRowId={(c) => c.id}
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
        onRowClick={canEdit ? (c) => setDrawer({ mode: 'edit', coupon: c }) : (c) => setUsagesFor(c)}
        toolbar={<SearchInput value={filters.search} onChange={(v) => setFilters({ search: v, page: '1' })} placeholder="Search code or note…" className="w-full sm:w-72" label="Search coupons" />}
        rowActions={(c) => (
          <Menu
            label={`Actions for ${c.code}`}
            items={[
              { label: 'Edit', icon: Pencil, onSelect: () => setDrawer({ mode: 'edit', coupon: c }), hidden: !canEdit },
              { label: 'View redemptions', icon: History, onSelect: () => setUsagesFor(c) },
              { label: c.enabled ? 'Disable' : 'Enable', icon: c.enabled ? PowerOff : Power, onSelect: () => void toggle(c), hidden: !canEdit },
              { label: 'Duplicate', icon: Copy, onSelect: () => setDrawer({ mode: 'duplicate', coupon: c }), hidden: !canCreate },
              { label: 'Delete', icon: Trash2, danger: true, separator: true, onSelect: () => void remove(c), hidden: !canDelete },
            ]}
          />
        )}
        empty={
          filtered ? (
            <EmptyState icon={Ticket} title="No coupons match" description="Try another status or search term." action={<Button size="sm" onClick={resetFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState
              icon={Ticket}
              title="No coupons yet"
              description="Create a code for matchday promos, first orders or VIP customers."
              action={canCreate && <Button variant="primary" size="sm" icon={Plus} onClick={() => setDrawer({ mode: 'create' })}>Create coupon</Button>}
            />
          )
        }
      />

      <CouponFormDrawer state={drawer} onClose={() => setDrawer(null)} onSaved={onSaved} catalog={catalog} />
      <CouponUsagesDrawer coupon={usagesFor} onClose={() => setUsagesFor(null)} />
    </div>
  );
}
