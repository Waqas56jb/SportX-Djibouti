import { Clock, Hourglass, Inbox, Siren, type LucideIcon } from 'lucide-react';
import type { SupportTicket } from '@/types';
import { Skeleton } from '@/components/common';
import { cn } from '@/utils/cn';

export type SummaryKey = 'open' | 'in_progress' | 'waiting_customer' | 'urgent';

const ITEMS: { key: SummaryKey; label: string; hint: string; icon: LucideIcon; tone: string }[] = [
  { key: 'open', label: 'Open', hint: 'Awaiting first response', icon: Inbox, tone: 'bg-sky-50 text-sky-600' },
  { key: 'in_progress', label: 'In progress', hint: 'Being handled', icon: Clock, tone: 'bg-ink-950 text-volt' },
  { key: 'waiting_customer', label: 'Waiting for customer', hint: 'Reply sent', icon: Hourglass, tone: 'bg-amber-50 text-amber-600' },
  { key: 'urgent', label: 'Urgent', hint: 'Unresolved, urgent priority', icon: Siren, tone: 'bg-red-50 text-red-600' },
];

export function countSummary(tickets: SupportTicket[]): Record<SummaryKey, number> {
  const active = (t: SupportTicket) => t.status !== 'resolved' && t.status !== 'closed';
  return {
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    waiting_customer: tickets.filter((t) => t.status === 'waiting_customer').length,
    urgent: tickets.filter((t) => t.priority === 'urgent' && active(t)).length,
  };
}

/** Workload overview; each tile doubles as a quick filter. */
export function TicketSummaryStrip({ counts, active, onSelect }: { counts?: Record<SummaryKey, number>; active: SummaryKey | null; onSelect: (k: SummaryKey) => void }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ITEMS.map((it) => {
        const on = active === it.key;
        const value = counts?.[it.key];
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(it.key)}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2',
              on ? 'border-ink-950 ring-1 ring-ink-950' : 'border-zinc-200 hover:border-zinc-300',
            )}
          >
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', it.tone)}>
              <it.icon size={18} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-zinc-500">{it.label}</span>
              {value === undefined ? (
                <Skeleton className="mt-1.5 h-6 w-10" />
              ) : (
                <span className={cn('block font-display text-[1.75rem] font-bold leading-none tabular', it.key === 'urgent' && value > 0 ? 'text-red-600' : 'text-zinc-950')}>{value}</span>
              )}
              <span className="mt-1 hidden truncate text-xs text-zinc-400 sm:block">{it.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
