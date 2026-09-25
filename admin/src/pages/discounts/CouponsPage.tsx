import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Copy, Pencil, Plus, Power, PowerOff, Repeat2, Ticket, TicketCheck, Trash2 } from 'lucide-react';
import type { Coupon, PromotionStatus } from '@/types';
import { Badge, Button, EmptyState, Menu, PageHeader, StatusBadge, Tabs } from '@/components/common';
import { SearchInput } from '@/components/forms';
import { DataTable, type Column } from '@/components/tables';
import { CopyCode, StatStrip, UsageMeter } from '@/components/marketing/MarketingParts';
import { CouponFormDrawer, type CouponDrawerState } from '@/components/marketing/CouponFormDrawer';
import { useMarketingCatalog } from '@/components/marketing/useMarketingData';
import { discountLabel, errorMessage } from '@/components/marketing/utils';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/misc';
import { usePermission } from '@/hooks/usePermission';
import { discountService, promotionStatus } from '@/services/discountService';
import { PROMOTION_STATUS } from '@/constants/status';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { formatDate, formatMoney, formatNumber } from '@/utils/format';

type Tab = 'all' | PromotionStatus;
const TABS: Tab[] = ['all', 'active', 'scheduled', 'expired', 'disabled'];

export default function CouponsPage() {
  const { filters, setFilter, resetFilters } = useUrlFilters({ status: 'all', search: '' });
  const [params, setParams] = useSearchParams();
  const search = useDebounce(filters.search, 200);
  const tab = (TABS.includes(filters.status as Tab) ? filters.status : 'all') as Tab;
  const { data, loading, error, reload, setData } = useAsync(() => discountService.getCoupons(), []);
  const catalog = useMarketingCatalog();
  const [drawer, setDrawer] = useState<CouponDrawerState | null>(null);
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

  const withStatus = useMemo(() => (data ?? []).map((c) => ({ c, status: promotionStatus(c) })), [data]);
  const counts = useMemo(() => {
    const out: Record<Tab, number> = { all: withStatus.length, active: 0, scheduled: 0, expired: 0, disabled: 0 };
    withStatus.forEach((x) => out[x.status]++);
    return out;
  }, [withStatus]);
  const redemptions = useMemo(() => (data ?? []).reduce((s, c) => s + c.usageCount, 0), [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withStatus.filter((x) => (tab === 'all' || x.status === tab) && (!q || x.c.code.toLowerCase().includes(q) || x.c.description.toLowerCase().includes(q)));
  }, [withStatus, tab, search]);

  const replace = (c: Coupon) => setData((list) => (list ? list.map((x) => (x.id === c.id ? c : x)) : list));

  const toggle = async (c: Coupon) => {
    try {
      const saved = await discountService.setCouponEnabled(c.id, !c.enabled);
      replace({ ...saved });
      toast.success(saved.enabled ? 'Coupon enabled.' : 'Coupon disabled.', { description: saved.code });
    } catch (e) {
      toast.error('Couldn’t update coupon.', { description: errorMessage(e) });
    }
  };

  const remove = async (c: Coupon) => {
    const ok = await confirm({
      title: `Delete ${c.code}?`,
      description: c.usageCount ? `This coupon has been redeemed ${formatNumber(c.usageCount)} times. Past orders keep their discount, but the code will stop working immediately.` : 'The code will stop working immediately. This action cannot be undone.',
      confirmLabel: 'Delete coupon',
    });
    if (!ok) return;
    try {
      await discountService.deleteCoupon(c.id);
      setData((list) => list?.filter((x) => x.id !== c.id));
      toast.success('Coupon deleted.', { description: c.code });
    } catch (e) {
      toast.error('Couldn’t delete coupon.', { description: errorMessage(e) });
    }
  };

  const onSaved = (c: Coupon, mode: CouponDrawerState['mode']) => {
    setDrawer(null);
    if (mode === 'edit') replace({ ...c });
    else setData((list) => [c, ...(list ?? []).filter((x) => x.id !== c.id)]);
  };

  const columns: Column<{ c: Coupon; status: PromotionStatus }>[] = [
    {
      id: 'code',
      header: 'Code',
      mobile: 'title',
      hideable: false,
      sortValue: (r) => r.c.code,
      cell: ({ c }) => (
        <div className="min-w-0">
          <CopyCode code={c.code} />
          {c.description && <div className="mt-1 max-w-[240px] truncate text-xs text-zinc-500">{c.description}</div>}
        </div>
      ),
    },
    { id: 'type', header: 'Type', cell: ({ c }) => <Badge tone="neutral">{c.type === 'percentage' ? 'Percentage' : 'Fixed amount'}</Badge>, sortValue: (r) => r.c.type },
    { id: 'value', header: 'Value', align: 'right', mobile: 'aside', sortValue: (r) => (r.c.type === 'percentage' ? r.c.value * 1000 : r.c.value), cell: ({ c }) => <span className="font-semibold tabular text-zinc-950">{discountLabel(c.type, c.value)}</span> },
    { id: 'usage', header: 'Usage', sortValue: (r) => r.c.usageCount, cell: ({ c }) => <UsageMeter count={c.usageCount} limit={c.usageLimit} /> },
    { id: 'limit', header: 'Per customer', label: 'Per-customer limit', align: 'right', sortValue: (r) => r.c.perCustomerLimit ?? Infinity, cell: ({ c }) => <span className="tabular text-zinc-700">{c.perCustomerLimit ?? '—'}</span> },
    { id: 'min', header: 'Min. order', label: 'Minimum order', align: 'right', sortValue: (r) => r.c.minOrder, cell: ({ c }) => <span className="tabular text-zinc-700">{c.minOrder ? formatMoney(c.minOrder) : '—'}</span> },
    { id: 'start', header: 'Start', sortValue: (r) => r.c.startsAt, cell: ({ c }) => <span className="tabular text-zinc-700">{formatDate(c.startsAt)}</span> },
    { id: 'end', header: 'End', sortValue: (r) => r.c.endsAt ?? '9999', cell: ({ c }) => <span className="tabular text-zinc-700">{c.endsAt ? formatDate(c.endsAt) : 'No end'}</span> },
    { id: 'status', header: 'Status', mobile: 'subtitle', sortValue: (r) => r.status, cell: (r) => <StatusBadge map={PROMOTION_STATUS} value={r.status} /> },
  ];

  const filtered = tab !== 'all' || Boolean(search);

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
        loading={loading}
        items={[
          { label: 'Active coupons', value: counts.active, icon: TicketCheck, accent: true, hint: 'Redeemable right now' },
          { label: 'Scheduled', value: counts.scheduled, icon: CalendarClock, hint: 'Start in the future' },
          { label: 'Total redemptions', value: formatNumber(redemptions), icon: Repeat2, hint: 'Across all coupons' },
        ]}
      />

      <Tabs
        ariaLabel="Filter coupons by status"
        className="mb-4"
        value={tab}
        onChange={(v) => setFilter('status', v)}
        items={TABS.map((t) => ({ value: t, label: t === 'all' ? 'All coupons' : PROMOTION_STATUS[t].label, count: loading ? undefined : counts[t] }))}
      />

      <DataTable
        caption="Coupons"
        storageKey="coupons"
        data={rows}
        columns={columns}
        getRowId={(r) => r.c.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        initialSort={{ id: 'start', dir: 'desc' }}
        onRowClick={canEdit ? (r) => setDrawer({ mode: 'edit', coupon: r.c }) : undefined}
        toolbar={<SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search code or note…" className="w-full sm:w-72" label="Search coupons" />}
        rowActions={({ c }) => (
          <Menu
            label={`Actions for ${c.code}`}
            items={[
              { label: 'Edit', icon: Pencil, onSelect: () => setDrawer({ mode: 'edit', coupon: c }), hidden: !canEdit },
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
    </div>
  );
}
