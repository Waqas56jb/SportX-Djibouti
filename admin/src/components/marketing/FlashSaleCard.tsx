import { Pencil, Power, PowerOff, Timer, Trash2, Zap } from 'lucide-react';
import type { FlashSale, FlashSaleStatus, MarketingProduct } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime, formatMoney, formatNumber, formatShortDate, formatTime } from '@/utils/format';
import { Menu, StatusBadge } from '@/components/common';
import { ThumbStack } from './ProductPicker';
import { FLASH_SALE_STATUS, formatDuration, rangeProgress } from './utils';

export interface FlashSaleCardProps {
  sale: FlashSale;
  status: FlashSaleStatus;
  now: number;
  products: MarketingProduct[];
  onEdit?: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
}

function countdown(sale: FlashSale, status: FlashSaleStatus, now: number): { text: string; tone: 'live' | 'soon' | 'muted' } {
  const start = new Date(sale.startsAt).getTime();
  const end = new Date(sale.endsAt).getTime();
  if (status === 'active') return { text: `Ends in ${formatDuration(end - now)}`, tone: 'live' };
  if (status === 'upcoming') return { text: `Starts in ${formatDuration(start - now)}`, tone: 'soon' };
  if (status === 'ended') return { text: `Ended ${formatDuration(now - end)} ago`, tone: 'muted' };
  return { text: now < start ? `Would start in ${formatDuration(start - now)}` : 'Paused', tone: 'muted' };
}

/** Time bar from start to end with a "now" marker. */
function TimelineBar({ sale, status, now }: { sale: FlashSale; status: FlashSaleStatus; now: number }) {
  const p = rangeProgress(sale.startsAt, sale.endsAt, now);
  const within = p > 0 && p < 1;
  const sameDay = new Date(sale.startsAt).toDateString() === new Date(sale.endsAt).toDateString();
  return (
    <div>
      <div className="relative h-2 rounded-full bg-zinc-100">
        <div className={cn('absolute inset-y-0 left-0 rounded-full', status === 'active' ? 'bg-volt-600' : status === 'ended' ? 'bg-zinc-300' : 'bg-zinc-200')} style={{ width: `${p * 100}%` }} />
        {status !== 'ended' && (
          <span
            className="absolute top-1/2 flex"
            style={{ left: `${p * 100}%`, transform: `translate(${within ? '-50%' : p <= 0 ? '0' : '-100%'}, -50%)` }}
            aria-hidden
          >
            <span className={cn('h-4 w-1 rounded-full ring-2 ring-white', status === 'active' ? 'bg-ink-950' : 'bg-sky-500')} />
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs tabular text-zinc-500">
        <span>
          <span className="font-medium text-zinc-700">{formatShortDate(sale.startsAt)}</span> {formatTime(sale.startsAt)}
        </span>
        {status === 'active' && <span className="font-semibold text-zinc-900">Now · {Math.round(p * 100)}%</span>}
        <span>
          {!sameDay && <span className="font-medium text-zinc-700">{formatShortDate(sale.endsAt)} </span>}
          {formatTime(sale.endsAt)}
        </span>
      </div>
    </div>
  );
}

export function FlashSaleCard({ sale, status, now, products, onEdit, onToggle, onDelete }: FlashSaleCardProps) {
  const cd = countdown(sale, status, now);
  const hours = Math.round((new Date(sale.endsAt).getTime() - new Date(sale.startsAt).getTime()) / 3_600_000);
  const showMetrics = status === 'active' || status === 'ended' || sale.unitsSold > 0;
  return (
    <article className={cn('panel flex flex-col p-5 transition-shadow hover:shadow-pop', status === 'active' && 'ring-1 ring-volt-600/60')} aria-label={sale.name}>
      <header className="flex items-start gap-3">
        <div className={cn('flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl', status === 'active' ? 'bg-ink-950 text-volt' : 'bg-zinc-100 text-zinc-800')}>
          <span className="font-display text-2xl font-extrabold italic leading-none tabular">−{sale.discountPercent}</span>
          <span className="text-2xs font-semibold uppercase tracking-wider opacity-80">% off</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge map={FLASH_SALE_STATUS} value={status} />
            <span className="text-xs text-zinc-500">{hours < 48 ? `${hours}h window` : `${Math.round(hours / 24)}-day window`}</span>
          </div>
          <h3 className="mt-1 truncate text-[0.9375rem] font-semibold text-zinc-950" title={sale.name}>
            {sale.name}
          </h3>
          <div
            className={cn(
              'mt-1 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold tabular',
              cd.tone === 'live' && 'text-zinc-950',
              cd.tone === 'soon' && 'text-sky-700',
              cd.tone === 'muted' && 'text-zinc-500',
            )}
            title={`${formatDateTime(sale.startsAt)} → ${formatDateTime(sale.endsAt)}`}
          >
            {cd.tone === 'live' ? (
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt-600 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-volt-600" />
              </span>
            ) : (
              <Timer size={14} aria-hidden />
            )}
            {cd.text}
          </div>
        </div>
        <Menu
          label={`Actions for ${sale.name}`}
          items={[
            { label: 'Edit', icon: Pencil, onSelect: () => onEdit?.(), hidden: !onEdit },
            { label: sale.enabled ? 'Disable' : 'Enable', icon: sale.enabled ? PowerOff : Power, onSelect: () => onToggle?.(), hidden: !onToggle },
            { label: 'Delete', icon: Trash2, danger: true, separator: true, onSelect: () => onDelete?.(), hidden: !onDelete },
          ]}
        />
      </header>

      <div className="mt-5">
        <TimelineBar sale={sale} status={status} now={now} />
      </div>

      <footer className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-zinc-100 pt-4">
        <div className="flex items-center gap-3">
          {products.length ? <ThumbStack products={products} max={4} /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400"><Zap size={15} aria-hidden /></span>}
          <span className="text-[0.8125rem] text-zinc-600">
            <span className="font-semibold text-zinc-900 tabular">{sale.productIds.length}</span> product{sale.productIds.length === 1 ? '' : 's'}
          </span>
        </div>
        {showMetrics && (
          <dl className="flex gap-5 text-right">
            <div>
              <dt className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Units sold</dt>
              <dd className="font-display text-xl font-bold leading-tight text-zinc-950 tabular">{formatNumber(sale.unitsSold)}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Revenue</dt>
              <dd className="font-display text-xl font-bold leading-tight text-zinc-950 tabular">{formatMoney(sale.revenue, { compact: true })}</dd>
            </div>
          </dl>
        )}
      </footer>
    </article>
  );
}
