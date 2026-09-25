import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Megaphone, MousePointerClick, Plus, TrendingUp } from 'lucide-react';
import type { Campaign, CampaignStatus } from '@/types';
import { Button, DemoBadge, EmptyState, ErrorState, PageHeader, SkeletonPanel, Tabs } from '@/components/common';
import { FilterSelect, SearchInput } from '@/components/forms';
import { ClearFiltersButton } from '@/components/tables';
import { StatStrip } from '@/components/marketing/MarketingParts';
import { CampaignCard } from '@/components/marketing/CampaignCard';
import { CampaignFormDrawer } from '@/components/marketing/CampaignFormDrawer';
import { useMarketingCatalog, useNow } from '@/components/marketing/useMarketingData';
import { errorMessage } from '@/components/marketing/utils';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePermission } from '@/hooks/usePermission';
import { campaignService } from '@/services/campaignService';
import { CAMPAIGN_STATUS } from '@/constants/status';
import { CAMPAIGN_TYPES } from '@/constants/catalog';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { formatMoney, formatNumber, formatPercent } from '@/utils/format';

type Tab = 'all' | CampaignStatus;
const TABS: Tab[] = ['all', 'active', 'scheduled', 'draft', 'paused', 'ended', 'archived'];

const STATUS_TOAST: Partial<Record<CampaignStatus, string>> = { active: 'Campaign activated.', paused: 'Campaign paused.', archived: 'Campaign archived.' };

export default function CampaignsPage() {
  const { filters, setFilter, resetFilters, activeCount } = useUrlFilters({ status: 'all', type: '', search: '' });
  const tab = (TABS.includes(filters.status as Tab) ? filters.status : 'all') as Tab;
  const [params, setParams] = useSearchParams();
  const now = useNow(60_000);
  const { data, loading, error, reload, setData } = useAsync(() => campaignService.getCampaigns(), []);
  const catalog = useMarketingCatalog();
  const [drawer, setDrawer] = useState<{ campaign?: Campaign } | null>(null);
  const canCreate = usePermission('discounts:create');
  const canEdit = usePermission('discounts:edit');
  const canDelete = usePermission('discounts:delete');

  useEffect(() => {
    if (params.get('new') !== '1') return;
    if (canCreate) setDrawer({});
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('new');
        return next;
      },
      { replace: true },
    );
  }, [params, setParams, canCreate]);

  const counts = useMemo(() => {
    const out = { all: 0, draft: 0, scheduled: 0, active: 0, paused: 0, archived: 0, ended: 0 } as Record<Tab, number>;
    (data ?? []).forEach((c) => {
      out.all++;
      out[c.status]++;
    });
    return out;
  }, [data]);

  const totals = useMemo(() => {
    const live = (data ?? []).filter((c) => c.status !== 'draft');
    const impressions = live.reduce((s, c) => s + c.impressions, 0);
    const clicks = live.reduce((s, c) => s + c.clicks, 0);
    return { revenue: live.reduce((s, c) => s + c.revenue, 0), ctr: impressions ? (clicks / impressions) * 100 : 0 };
  }, [data]);

  const visible = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return (data ?? []).filter((c) => (tab === 'all' || c.status === tab) && (!filters.type || c.type === filters.type) && (!q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)));
  }, [data, tab, filters.type, filters.search]);

  const replace = (c: Campaign) => setData((list) => list?.map((x) => (x.id === c.id ? c : x)));

  const setStatus = async (c: Campaign, status: CampaignStatus) => {
    if (status === 'archived' && !(await confirm({ title: `Archive “${c.name}”?`, description: 'The campaign is removed from the storefront and moved to the archive. Its metrics are kept.', confirmLabel: 'Archive campaign', tone: 'default' }))) return;
    try {
      const saved = await campaignService.setStatus(c.id, status);
      replace(saved);
      toast.success(STATUS_TOAST[status] ?? 'Campaign updated.', { description: saved.name });
    } catch (e) {
      toast.error('Couldn’t update campaign.', { description: errorMessage(e) });
    }
  };

  const remove = async (c: Campaign) => {
    if (!(await confirm({ title: `Delete “${c.name}”?`, description: 'The campaign and its banner are removed permanently. This action cannot be undone.', confirmLabel: 'Delete campaign' }))) return;
    try {
      await campaignService.deleteCampaign(c.id);
      setData((list) => list?.filter((x) => x.id !== c.id));
      toast.success('Campaign deleted.', { description: c.name });
    } catch (e) {
      toast.error('Couldn’t delete campaign.', { description: errorMessage(e) });
    }
  };

  const create = () => setDrawer({});
  const filtered = tab !== 'all' || activeCount > 0 || Boolean(filters.search);

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Storefront campaigns with banners, product selections and schedules."
        actions={canCreate && <Button variant="primary" icon={Plus} onClick={create}>Create campaign</Button>}
      />

      <StatStrip
        loading={loading}
        items={[
          { label: 'Active campaigns', value: counts.active, icon: Megaphone, accent: true },
          { label: 'Scheduled', value: counts.scheduled, icon: CalendarClock },
          { label: 'Average CTR', value: formatPercent(totals.ctr, { decimals: 2 }), icon: MousePointerClick, hint: 'Demo data' },
          { label: 'Campaign revenue', value: formatMoney(totals.revenue, { compact: true }), icon: TrendingUp, hint: 'Demo data' },
        ]}
      />

      <Tabs
        ariaLabel="Filter campaigns by status"
        className="mb-4"
        value={tab}
        onChange={(v) => setFilter('status', v)}
        items={TABS.map((t) => ({ value: t, label: t === 'all' ? 'All' : CAMPAIGN_STATUS[t].label, count: loading ? undefined : counts[t] }))}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search campaigns…" className="w-full sm:w-72" label="Search campaigns" />
        <FilterSelect label="Type" value={filters.type} onChange={(v) => setFilter('type', v)} options={CAMPAIGN_TYPES} />
        <ClearFiltersButton count={activeCount} onClear={resetFilters} />
        <span className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          {!loading && `${formatNumber(visible.length)} campaign${visible.length === 1 ? '' : 's'}`}
          <DemoBadge />
        </span>
      </div>

      {error ? (
        <div className="panel">
          <ErrorState onRetry={() => void reload()} description="We couldn’t load campaigns. Please try again." />
        </div>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonPanel key={i} rows={5} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="panel">
          {filtered ? (
            <EmptyState icon={Megaphone} title="No campaigns match" description="Try another status, type or search term." action={<Button size="sm" onClick={resetFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={Megaphone} title="No campaigns yet" description="Launch a seasonal push, a new-arrivals drop or a football weekend with its own banner." action={canCreate && <Button variant="primary" size="sm" icon={Plus} onClick={create}>Create campaign</Button>} />
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              now={now}
              actions={{
                onEdit: canEdit ? () => setDrawer({ campaign: c }) : undefined,
                onActivate: canEdit ? () => void setStatus(c, 'active') : undefined,
                onPause: canEdit ? () => void setStatus(c, 'paused') : undefined,
                onArchive: canEdit ? () => void setStatus(c, 'archived') : undefined,
                onDelete: canDelete ? () => void remove(c) : undefined,
              }}
            />
          ))}
        </div>
      )}

      <CampaignFormDrawer
        open={Boolean(drawer)}
        campaign={drawer?.campaign}
        catalog={catalog}
        onClose={() => setDrawer(null)}
        onSaved={(c, created) => {
          setDrawer(null);
          if (created) setData((list) => [c, ...(list ?? [])]);
          else replace(c);
        }}
      />
    </div>
  );
}
