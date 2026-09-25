import { Link } from 'react-router-dom';
import { AlertTriangle, Boxes, Layers, PackageX, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { InventorySummaryCounts } from '@/types';
import { Skeleton } from '@/components/common';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/format';

interface Stat {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  to?: string;
  tone?: 'warning' | 'danger';
}

/** Headline strip for the inventory module, from the API summary (ignores the status tab). */
export function InventorySummary({ summary, loading }: { summary: InventorySummaryCounts | undefined; loading: boolean }) {
  const s = summary ?? { total: 0, inStock: 0, lowStock: 0, outOfStock: 0, units: 0, reserved: 0 };

  const stats: Stat[] = [
    { label: 'Variants tracked', value: formatNumber(s.total), hint: `${formatNumber(s.inStock)} in stock`, icon: Layers, to: '/inventory' },
    { label: 'Units on hand', value: formatNumber(s.units), hint: `${formatNumber(Math.max(0, s.units - s.reserved))} available to sell`, icon: Boxes },
    { label: 'Low stock', value: formatNumber(s.lowStock), hint: 'At or below threshold', icon: AlertTriangle, to: '/inventory?status=low_stock', tone: s.lowStock ? 'warning' : undefined },
    { label: 'Out of stock', value: formatNumber(s.outOfStock), hint: 'No sellable units', icon: PackageX, to: '/inventory?status=out_of_stock', tone: s.outOfStock ? 'danger' : undefined },
    { label: 'Reserved', value: formatNumber(s.reserved), hint: 'Held for open orders', icon: Lock },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {stats.map((st, i) => {
        const body = (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.8125rem] font-medium text-zinc-500">{st.label}</span>
              <st.icon size={16} aria-hidden className={cn(st.tone === 'warning' ? 'text-amber-500' : st.tone === 'danger' ? 'text-red-500' : 'text-zinc-400')} />
            </div>
            {loading && !summary ? (
              <>
                <Skeleton className="mt-3 h-7 w-20" />
                <Skeleton className="mt-2 h-3 w-24" />
              </>
            ) : (
              <>
                <div className={cn('mt-2 font-display text-[1.75rem] font-bold leading-none tracking-tight tabular', st.tone === 'danger' ? 'text-red-600' : 'text-zinc-950')}>{st.value}</div>
                <div className="mt-1.5 text-xs text-zinc-500">{st.hint}</div>
              </>
            )}
          </>
        );
        const cls = cn('panel block p-4', i === 4 && 'col-span-2 md:col-span-1', st.to && 'transition-shadow hover:border-zinc-300 hover:shadow-pop');
        return st.to ? (
          <Link key={st.label} to={st.to} className={cls}>
            {body}
          </Link>
        ) : (
          <div key={st.label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
