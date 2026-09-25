import { useMemo, useState } from 'react';
import { CalendarClock, Plus, Timer, TrendingUp, Zap } from 'lucide-react';
import type { FlashSale } from '@/types';
import { Button, DemoBadge, EmptyState, ErrorState, PageHeader, SkeletonPanel, Tabs } from '@/components/common';
import { StatStrip } from '@/components/marketing/MarketingParts';
import { FlashSaleCard } from '@/components/marketing/FlashSaleCard';
import { FlashSaleFormDrawer } from '@/components/marketing/FlashSaleFormDrawer';
import { useMarketingCatalog, useNow } from '@/components/marketing/useMarketingData';
import { errorMessage } from '@/components/marketing/utils';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePermission } from '@/hooks/usePermission';
import { discountService, flashSaleStatus, type FlashSaleStatus } from '@/services/discountService';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { formatMoney, formatNumber } from '@/utils/format';

type Tab = 'all' | FlashSaleStatus;
const TABS: Tab[] = ['all', 'active', 'upcoming', 'ended', 'disabled'];
const TAB_LABEL: Record<Tab, string> = { all: 'All', active: 'Active', upcoming: 'Upcoming', ended: 'Ended', disabled: 'Disabled' };
const GROUP_ORDER: FlashSaleStatus[] = ['active', 'upcoming', 'ended', 'disabled'];
const GROUP_TITLE: Record<FlashSaleStatus, string> = { active: 'Live now', upcoming: 'Upcoming', ended: 'Ended', disabled: 'Disabled' };

export default function FlashSalesPage() {
  const { filters, setFilter } = useUrlFilters({ tab: 'all' });
  const tab = (TABS.includes(filters.tab as Tab) ? filters.tab : 'all') as Tab;
  const now = useNow(30_000);
  const { data, loading, error, reload, setData } = useAsync(() => discountService.getFlashSales(), []);
  const catalog = useMarketingCatalog();
  const [drawer, setDrawer] = useState<{ sale?: FlashSale } | null>(null);
  const canCreate = usePermission('discounts:create');
  const canEdit = usePermission('discounts:edit');
  const canDelete = usePermission('discounts:delete');

  const items = useMemo(
    () =>
      (data ?? []).map((s) => ({ s, status: flashSaleStatus(s) })).sort((a, b) => {
        const g = GROUP_ORDER.indexOf(a.status) - GROUP_ORDER.indexOf(b.status);
        if (g) return g;
        // upcoming soonest first, others most recent first
        return a.status === 'upcoming' ? a.s.startsAt.localeCompare(b.s.startsAt) : b.s.startsAt.localeCompare(a.s.startsAt);
      }),
    // `now` re-derives status as sales start and end
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, now],
  );
  const counts = useMemo(() => {
    const out: Record<Tab, number> = { all: items.length, active: 0, upcoming: 0, ended: 0, disabled: 0 };
    items.forEach((x) => out[x.status]++);
    return out;
  }, [items]);
  const totals = useMemo(() => items.reduce((acc, x) => ({ units: acc.units + x.s.unitsSold, revenue: acc.revenue + x.s.revenue }), { units: 0, revenue: 0 }), [items]);

  const replace = (s: FlashSale) => setData((list) => list?.map((x) => (x.id === s.id ? s : x)));

  const toggle = async (s: FlashSale) => {
    try {
      const saved = await discountService.updateFlashSale(s.id, { name: s.name, discountPercent: s.discountPercent, productIds: s.productIds, startsAt: s.startsAt, endsAt: s.endsAt, enabled: !s.enabled });
      replace(saved);
      toast.success(saved.enabled ? 'Flash sale enabled.' : 'Flash sale disabled.', { description: saved.name });
    } catch (e) {
      toast.error('Couldn’t update flash sale.', { description: errorMessage(e) });
    }
  };

  const remove = async (s: FlashSale) => {
    const live = flashSaleStatus(s) === 'active';
    if (!(await confirm({ title: `Delete “${s.name}”?`, description: live ? 'This sale is live. Prices return to normal immediately for every product in it.' : 'This action cannot be undone.', confirmLabel: 'Delete flash sale' }))) return;
    try {
      await discountService.deleteFlashSale(s.id);
      setData((list) => list?.filter((x) => x.id !== s.id));
      toast.success('Flash sale deleted.', { description: s.name });
    } catch (e) {
      toast.error('Couldn’t delete flash sale.', { description: errorMessage(e) });
    }
  };

  const visible = tab === 'all' ? items : items.filter((x) => x.status === tab);
  const groups = tab === 'all' ? GROUP_ORDER.map((g) => ({ g, list: visible.filter((x) => x.status === g) })).filter((x) => x.list.length) : [{ g: tab as FlashSaleStatus, list: visible }];
  const create = () => setDrawer({});

  const renderCard = ({ s, status }: { s: FlashSale; status: FlashSaleStatus }) => (
    <FlashSaleCard
      key={s.id}
      sale={s}
      status={status}
      now={now}
      products={s.productIds.map((id) => catalog.productById.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p))}
      onEdit={canEdit ? () => setDrawer({ sale: s }) : undefined}
      onToggle={canEdit ? () => void toggle(s) : undefined}
      onDelete={canDelete ? () => void remove(s) : undefined}
    />
  );

  return (
    <div>
      <PageHeader
        title="Flash sales"
        description="Time-boxed markdowns with live countdowns. Upcoming sales go live automatically at their start time."
        actions={canCreate && <Button variant="primary" icon={Plus} onClick={create}>Create flash sale</Button>}
      />

      <StatStrip
        loading={loading}
        items={[
          { label: 'Live now', value: counts.active, icon: Zap, accent: true },
          { label: 'Upcoming', value: counts.upcoming, icon: CalendarClock },
          { label: 'Units sold', value: formatNumber(totals.units), icon: Timer, hint: 'All flash sales · demo data' },
          { label: 'Flash sale revenue', value: formatMoney(totals.revenue, { compact: true }), icon: TrendingUp, hint: 'All flash sales · demo data' },
        ]}
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <Tabs
          ariaLabel="Filter flash sales"
          className="min-w-0 flex-1"
          value={tab}
          onChange={(v) => setFilter('tab', v)}
          items={TABS.map((t) => ({ value: t, label: TAB_LABEL[t], count: loading ? undefined : counts[t] }))}
        />
        <DemoBadge className="mb-3" />
      </div>

      {error ? (
        <div className="panel">
          <ErrorState onRetry={() => void reload()} description="We couldn’t load flash sales. Please try again." />
        </div>
      ) : loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonPanel key={i} rows={3} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={Zap}
            title={tab === 'all' ? 'No flash sales yet' : `No ${tab === 'active' ? 'live' : tab} flash sales`}
            description={tab === 'all' || tab === 'active' || tab === 'upcoming' ? 'Schedule a short, sharp markdown on hero products — boots drops, jersey launches, weekend deals.' : 'Nothing to show here.'}
            action={canCreate && (tab === 'all' || tab === 'active' || tab === 'upcoming') && <Button variant="primary" size="sm" icon={Plus} onClick={create}>Create flash sale</Button>}
            secondaryAction={tab !== 'all' && <Button size="sm" onClick={() => setFilter('tab', 'all')}>View all</Button>}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ g, list }) => (
            <section key={g} aria-labelledby={tab === 'all' ? `fs-${g}` : undefined} aria-label={tab === 'all' ? undefined : GROUP_TITLE[g]}>
              {tab === 'all' && (
                <h2 id={`fs-${g}`} className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  {g === 'active' && <span className="h-2 w-2 rounded-full bg-volt-600" aria-hidden />}
                  {GROUP_TITLE[g]} <span className="font-normal text-zinc-400 tabular">{list.length}</span>
                </h2>
              )}
              <div className="grid gap-4 lg:grid-cols-2">{list.map(renderCard)}</div>
            </section>
          ))}
        </div>
      )}

      <FlashSaleFormDrawer
        open={Boolean(drawer)}
        sale={drawer?.sale}
        catalog={catalog}
        onClose={() => setDrawer(null)}
        onSaved={(s, created) => {
          setDrawer(null);
          if (created) setData((list) => [s, ...(list ?? [])]);
          else replace(s);
        }}
      />
    </div>
  );
}
