import { Clock, Crown, Filter, Repeat, Sparkles, Users, type LucideIcon } from 'lucide-react';
import type { CustomerGroup } from '@/types';
import { Skeleton } from '@/components/common';
import { cn } from '@/utils/cn';
import { formatMoney, formatNumber } from '@/utils/format';

export const GROUP_ICON: Record<CustomerGroup, LucideIcon> = {
  all: Users,
  new: Sparkles,
  returning: Repeat,
  high_value: Crown,
  inactive: Clock,
};

export interface GroupCardProps {
  id: CustomerGroup;
  label: string;
  description: string;
  rule: string;
  count?: number;
  revenue?: number;
  /** Share of all customers, 0–1. */
  share?: number;
  selected: boolean;
  onSelect: () => void;
}

/** Selectable segment card: size, lifetime revenue, share of base and read-only rule. */
export function GroupCard({ id, label, description, rule, count, revenue, share, selected, onSelect }: GroupCardProps) {
  const Icon = GROUP_ICON[id];
  const loading = count === undefined;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group relative flex h-full flex-col rounded-xl border bg-white p-4 text-left shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2',
        selected ? 'border-ink-950 ring-1 ring-ink-950' : 'border-zinc-200 hover:border-zinc-300 hover:shadow-pop',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', selected ? 'bg-ink-950 text-volt' : 'bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200/70')}>
          <Icon size={17} aria-hidden />
        </span>
        {selected && <span className="rounded-md bg-volt px-1.5 py-0.5 text-2xs font-semibold text-ink-950">Viewing</span>}
      </span>
      <span className="mt-3 block text-sm font-semibold text-zinc-900">{label}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{description}</span>

      <span className="mt-4 flex items-end justify-between gap-2">
        {loading ? (
          <Skeleton className="h-8 w-14" />
        ) : (
          <span className="font-display text-[2rem] font-bold leading-none text-zinc-950 tabular">{formatNumber(count)}</span>
        )}
        {loading ? <Skeleton className="h-3.5 w-20" /> : <span className="text-xs font-medium text-zinc-500 tabular">{formatMoney(revenue ?? 0, { compact: true })}</span>}
      </span>
      <span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
        <span className={cn('block h-full rounded-full transition-all', selected ? 'bg-volt-600' : 'bg-zinc-400')} style={{ width: `${Math.round((share ?? 0) * 100)}%` }} />
      </span>
      <span className="mt-1 block text-2xs text-zinc-400 tabular">{share !== undefined ? `${Math.round(share * 100)}% of customers` : ' '}</span>

      <span className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-2xs font-medium text-zinc-600">
          <Filter size={11} aria-hidden /> {rule}
        </span>
      </span>
    </button>
  );
}
