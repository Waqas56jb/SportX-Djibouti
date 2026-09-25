import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { toast } from '@/store/toastStore';
import { formatNumber } from '@/utils/format';
import { Skeleton } from '@/components/common';

/** Monospace code with a one-click copy button. */
export function CopyCode({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`Copied ${code} to clipboard.`);
    } catch {
      toast.error('Couldn’t copy the code.', { description: 'Your browser blocked clipboard access.' });
    }
  };
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-2 py-0.5 font-mono text-[0.8125rem] font-semibold tracking-wide text-zinc-900">{code}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `Copied ${code}` : `Copy code ${code}`}
        title="Copy code"
        className={cn('rounded-md p-1 transition-colors', copied ? 'text-emerald-600' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900')}
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
    </span>
  );
}

/** "212 / 300" with a hairline progress bar. */
export function UsageMeter({ count, limit, className }: { count: number; limit?: number; className?: string }) {
  const pct = limit ? Math.min(100, (count / limit) * 100) : 0;
  const tone = pct >= 100 ? 'bg-zinc-400' : pct >= 85 ? 'bg-amber-500' : 'bg-ink-950';
  return (
    <div className={cn('min-w-[96px]', className)}>
      <div className="text-[0.8125rem] tabular text-zinc-900">
        <span className="font-semibold">{formatNumber(count)}</span>
        <span className="text-zinc-400"> / {limit ? formatNumber(limit) : '∞'}</span>
      </div>
      {limit ? (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={count} aria-label="Redemptions">
          <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="mt-1 text-2xs text-zinc-400">Unlimited</div>
      )}
    </div>
  );
}

export interface StatItem {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: string;
  accent?: boolean;
}

/** Horizontal summary strip of compact stat tiles. */
export function StatStrip({ items, loading, className }: { items: StatItem[]; loading?: boolean; className?: string }) {
  return (
    <div className={cn('mb-5 grid gap-3 sm:grid-cols-2', items.length >= 3 && 'lg:grid-cols-3', items.length >= 4 && 'xl:grid-cols-4', className)}>
      {items.map((s) => (
        <div key={s.label} className="flex items-center gap-3.5 rounded-xl border border-zinc-200/80 bg-white px-4 py-3.5 shadow-card">
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', s.accent ? 'bg-ink-950 text-volt' : 'bg-zinc-100 text-zinc-600')}>
            <s.icon size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            {loading ? <Skeleton className="h-6 w-14" /> : <div className="font-display text-2xl font-bold leading-none text-zinc-950 tabular">{s.value}</div>}
            <div className="mt-1 truncate text-[0.8125rem] font-medium text-zinc-600">{s.label}</div>
            {s.hint && <div className="truncate text-2xs text-zinc-400">{s.hint}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Thin elapsed-time bar for a date range. */
export function RangeProgress({ value, className, tone = 'ink' }: { value: number; className?: string; tone?: 'ink' | 'volt' | 'muted' }) {
  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-zinc-100', className)} aria-hidden>
      <div className={cn('h-full rounded-full', tone === 'ink' && 'bg-ink-950', tone === 'volt' && 'bg-volt-600', tone === 'muted' && 'bg-zinc-300')} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
