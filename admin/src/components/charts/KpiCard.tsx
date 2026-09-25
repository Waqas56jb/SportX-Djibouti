import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Delta } from '@/components/common/Misc';
import { Skeleton } from '@/components/common/States';
import { Sparkline } from './ChartParts';

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  change?: number;
  /** Lower is better (e.g. refunds). */
  inverse?: boolean;
  period?: string;
  trend?: number[];
  icon?: LucideIcon;
  loading?: boolean;
  to?: string;
  className?: string;
}

/** Headline metric: value, change vs previous period, period label and a small trend. */
export function KpiCard({ label, value, change, inverse, period, trend, icon: Icon, loading, to, className }: KpiCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.8125rem] font-medium text-zinc-500">{label}</span>
        {Icon && <Icon size={16} className="text-zinc-400" aria-hidden />}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-7 w-28" />
          <Skeleton className="mt-3 h-3 w-36" />
          <Skeleton className="mt-3 h-9 w-full" />
        </>
      ) : (
        <>
          <div className="mt-2 font-display text-[2rem] font-bold leading-none tracking-tight text-zinc-950 tabular">{value}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            {change !== undefined && <Delta value={change} inverse={inverse} />}
            {period && <span>{change !== undefined ? `vs previous ${period.toLowerCase().replace(/^last /, '')}` : period}</span>}
          </div>
          {trend && (
            <div className="mt-3">
              <Sparkline data={trend} />
            </div>
          )}
        </>
      )}
    </>
  );
  const cls = cn('panel block p-5 transition-shadow', to && 'hover:border-zinc-300 hover:shadow-pop', className);
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Compact attention tile: count + label + tone, used for operational KPIs. */
export function AttentionStat({ label, value, icon: Icon, tone = 'neutral', to, hint, loading }: { label: string; value: number; icon: LucideIcon; tone?: 'neutral' | 'warning' | 'danger' | 'info'; to?: string; hint?: string; loading?: boolean }) {
  const toneCls = { neutral: 'bg-zinc-100 text-zinc-600', warning: 'bg-amber-50 text-amber-600', danger: 'bg-red-50 text-red-600', info: 'bg-sky-50 text-sky-600' }[tone];
  const inner = (
    <div className="flex items-center gap-3.5">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', toneCls)}>
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        {loading ? <Skeleton className="h-6 w-10" /> : <div className="font-display text-2xl font-bold leading-none text-zinc-950 tabular">{value}</div>}
        <div className="mt-1 truncate text-[0.8125rem] font-medium text-zinc-600">{label}</div>
        {hint && <div className="truncate text-2xs text-zinc-400">{hint}</div>}
      </div>
    </div>
  );
  const cls = 'block rounded-xl border border-zinc-200/80 bg-white px-4 py-3.5 transition-colors hover:border-zinc-300';
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
