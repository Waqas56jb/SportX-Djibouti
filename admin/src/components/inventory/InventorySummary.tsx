import { Link } from 'react-router-dom';
import { AlertTriangle, Boxes, Layers, PackageX, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { InventoryItem } from '@/types';
import { Skeleton, DemoBadge } from '@/components/common';
import { cn } from '@/utils/cn';
import { formatMoney, formatNumber } from '@/utils/format';

interface Stat {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  to?: string;
  tone?: 'warning' | 'danger';
}

/** Headline strip for the inventory module. Computed from the full (unfiltered) inventory. */
export function InventorySummary({ items, loading }: { items: InventoryItem[] | undefined; loading: boolean }) {
  const list = items ?? [];
  const units = list.reduce((s, i) => s + i.stock, 0);
  const reserved = list.reduce((s, i) => s + i.reserved, 0);
  const low = list.filter((i) => i.status === 'low_stock').length;
  const out = list.filter((i) => i.status === 'out_of_stock').length;
  const value = list.reduce((s, i) => s + i.stock * i.unitCost, 0);
  const products = new Set(list.map((i) => i.productId)).size;

  const stats: Stat[] = [
    { label: 'Variants tracked', value: formatNumber(list.length), hint: `${products} products`, icon: Layers, to: '/inventory' },
    { label: 'Units on hand', value: formatNumber(units), hint: `${formatNumber(reserved)} reserved`, icon: Boxes },
    { label: 'Low stock', value: formatNumber(low), hint: 'At or below threshold', icon: AlertTriangle, to: '/inventory?status=low_stock', tone: low ? 'warning' : undefined },
    { label: 'Out of stock', value: formatNumber(out), hint: 'No sellable units', icon: PackageX, to: '/inventory?status=out_of_stock', tone: out ? 'danger' : undefined },
    { label: 'Inventory value', value: formatMoney(value, { compact: true }), hint: 'At unit cost', icon: Wallet },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {stats.map((s, i) => {
        const body = (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.8125rem] font-medium text-zinc-500">{s.label}</span>
              <s.icon size={16} aria-hidden className={cn(s.tone === 'warning' ? 'text-amber-500' : s.tone === 'danger' ? 'text-red-500' : 'text-zinc-400')} />
            </div>
            {loading && !items ? (
              <>
                <Skeleton className="mt-3 h-7 w-20" />
                <Skeleton className="mt-2 h-3 w-24" />
              </>
            ) : (
              <>
                <div className={cn('mt-2 font-display text-[1.75rem] font-bold leading-none tracking-tight tabular', s.tone === 'danger' ? 'text-red-600' : 'text-zinc-950')}>{s.value}</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                  {s.hint}
                  {i === 4 && <DemoBadge className="ml-auto" />}
                </div>
              </>
            )}
          </>
        );
        const cls = cn('panel block p-4', i === 4 && 'col-span-2 md:col-span-1', s.to && 'transition-shadow hover:border-zinc-300 hover:shadow-pop');
        return s.to ? (
          <Link key={s.label} to={s.to} className={cls}>
            {body}
          </Link>
        ) : (
          <div key={s.label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
