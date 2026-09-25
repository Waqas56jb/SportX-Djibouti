import { Archive, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import type { Campaign } from '@/types';
import { CAMPAIGN_STATUS } from '@/constants/status';
import { formatMoney, formatNumber, formatPercent, formatShortDate } from '@/utils/format';
import { Menu, StatusBadge, type MenuItem } from '@/components/common';
import { CampaignBanner, campaignTypeLabel } from './CampaignBanner';
import { RangeProgress } from './MarketingParts';
import { formatDuration, rangeProgress } from './utils';

export interface CampaignActions {
  onEdit?: () => void;
  onActivate?: () => void;
  onPause?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

function timing(c: Campaign, now: number): string {
  const s = new Date(c.startsAt).getTime();
  const e = new Date(c.endsAt).getTime();
  if (now < s) return `Starts in ${formatDuration(s - now)}`;
  if (now > e) return `Ended ${formatShortDate(c.endsAt)}`;
  return `${formatDuration(e - now)} left`;
}

export function CampaignCard({ campaign: c, now, actions }: { campaign: Campaign; now: number; actions: CampaignActions }) {
  const p = rangeProgress(c.startsAt, c.endsAt, now);
  const ctr = c.impressions ? (c.clicks / c.impressions) * 100 : 0;
  const items: MenuItem[] = [
    { label: 'Edit', icon: Pencil, onSelect: () => actions.onEdit?.(), hidden: !actions.onEdit },
    { label: 'Activate', icon: Play, onSelect: () => actions.onActivate?.(), hidden: !actions.onActivate || c.status === 'active' || c.status === 'archived' },
    { label: 'Pause', icon: Pause, onSelect: () => actions.onPause?.(), hidden: !actions.onPause || c.status !== 'active' },
    { label: 'Archive', icon: Archive, onSelect: () => actions.onArchive?.(), hidden: !actions.onArchive || c.status === 'archived', separator: true },
    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => actions.onDelete?.(), hidden: !actions.onDelete },
  ];
  const metrics = [
    { label: 'Impressions', value: formatNumber(c.impressions, { compact: true }) },
    { label: 'Clicks', value: formatNumber(c.clicks, { compact: true }) },
    { label: 'CTR', value: c.impressions ? formatPercent(ctr, { decimals: 1 }) : '—' },
    { label: 'Revenue', value: formatMoney(c.revenue, { compact: true }) },
  ];

  return (
    <article className="panel group flex flex-col overflow-hidden transition-shadow hover:shadow-pop" aria-label={c.name}>
      <button type="button" onClick={actions.onEdit} disabled={!actions.onEdit} className="block text-left disabled:cursor-default" aria-label={`Edit ${c.name}`}>
        <CampaignBanner name={c.name} type={c.type} src={c.bannerUrl} className="aspect-[16/7] w-full" />
      </button>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge map={CAMPAIGN_STATUS} value={c.status} />
              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-2xs font-medium text-zinc-600">{campaignTypeLabel(c.type)}</span>
            </div>
            <h3 className="truncate text-[0.9375rem] font-semibold text-zinc-950" title={c.name}>
              {c.name}
            </h3>
          </div>
          <Menu label={`Actions for ${c.name}`} items={items} />
        </div>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[0.8125rem] leading-5 text-zinc-500">{c.description || 'No description.'}</p>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs tabular text-zinc-500">
            <span>
              {formatShortDate(c.startsAt)} → {formatShortDate(c.endsAt)}
            </span>
            <span className="font-medium text-zinc-700">{timing(c, now)}</span>
          </div>
          <RangeProgress value={p} tone={c.status === 'active' ? 'volt' : c.status === 'paused' ? 'ink' : 'muted'} />
        </div>

        <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-zinc-100 pt-4">
          {metrics.map((m) => (
            <div key={m.label} className="min-w-0">
              <dt className="truncate text-2xs font-semibold uppercase tracking-wider text-zinc-400">{m.label}</dt>
              <dd className="mt-0.5 truncate font-display text-lg font-bold leading-tight text-zinc-950 tabular">{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
