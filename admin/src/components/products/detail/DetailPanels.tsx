import { Eye, ShoppingBag, Star, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ProductListItem } from '@/types';
import { Panel, Rating } from '@/components/common';
import { formatMoney, formatNumber } from '@/utils/format';
import { discountPercent } from '../PriceTag';

export function PerformanceStats({ p }: { p: ProductListItem }) {
  const conversion = p.views ? (p.unitsSold / p.views) * 100 : 0;
  const tiles: { label: string; value: string; icon: LucideIcon; foot?: React.ReactNode }[] = [
    { label: 'Units sold', value: formatNumber(p.unitsSold), icon: ShoppingBag, foot: `${conversion.toFixed(1)}% view-to-sale` },
    { label: 'Revenue', value: formatMoney(p.revenue, { compact: true }), icon: Wallet, foot: p.unitsSold && p.revenue ? `${formatMoney(p.revenue / p.unitsSold)} avg. per unit` : p.unitsSold ? 'See the product report for revenue' : 'No sales yet' },
    { label: 'Product views', value: formatNumber(p.views, { compact: true }), icon: Eye, foot: 'All time' },
    { label: 'Rating', value: p.rating ? p.rating.toFixed(1) : '—', icon: Star, foot: p.reviewCount ? <Rating value={p.rating} size={12} /> : 'No reviews yet' },
  ];
  return (
    <Panel title="Performance" description="Lifetime totals">
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-zinc-200/80 p-4">
            <dt className="flex items-center gap-2 text-xs font-medium text-zinc-500">
              <t.icon size={14} className="text-zinc-400" aria-hidden /> {t.label}
            </dt>
            <dd className="mt-2 font-display text-[1.75rem] font-bold leading-none tabular text-zinc-950">{t.value}</dd>
            <dd className="mt-2 text-xs text-zinc-500">
              {t.foot}
              {t.label === 'Rating' && p.reviewCount > 0 && <span className="ml-1.5">({p.reviewCount})</span>}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function PricingSummary({ p }: { p: ProductListItem }) {
  const discount = discountPercent(p.price, p.compareAtPrice);
  const profit = p.costPrice !== undefined ? p.price - p.costPrice : undefined;
  const margin = profit !== undefined && p.price ? (profit / p.price) * 100 : undefined;
  const rows: [string, string][] = [
    ['Compare-at price', p.compareAtPrice ? formatMoney(p.compareAtPrice) : '—'],
    ['Discount', discount ? `${discount}%` : '—'],
    ['Cost price', p.costPrice !== undefined ? formatMoney(p.costPrice) : '—'],
    ['Profit per unit', profit !== undefined ? formatMoney(profit) : '—'],
    ['Margin', margin !== undefined ? `${margin.toFixed(1)}%` : '—'],
    ['Tax', `${p.taxRate}% included`],
  ];
  return (
    <Panel title="Pricing">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-4xl font-bold tabular tracking-tight text-zinc-950">{formatMoney(p.price)}</span>
        {discount > 0 && <span className="rounded bg-volt px-1.5 py-0.5 text-xs font-bold text-ink-950">−{discount}%</span>}
      </div>
      {discount > 0 && p.compareAtPrice !== undefined && <div className="mt-0.5 text-sm text-zinc-400 line-through tabular">{formatMoney(p.compareAtPrice)}</div>}
      <dl className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100 text-[0.8125rem]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-2">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="font-medium tabular text-zinc-900">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
