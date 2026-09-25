import { Link } from 'react-router-dom';
import { TrendingDown } from 'lucide-react';
import type { TopProduct } from '@/types';
import { EmptyState, ErrorState, Panel, ProductThumb, Skeleton } from '@/components/common';
import { formatNumber, formatPercent } from '@/utils/format';
import { ChartFrame, HBarChart } from './ChartKit';

interface Props {
  rows: TopProduct[] | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

const shortName = (n: string) => (n.length > 22 ? `${n.slice(0, 21)}…` : n);

/** Best sellers by units — single-hue magnitude bars. */
export function BestSellersPanel({ rows, loading, error, onRetry }: Props) {
  const top = [...(rows ?? [])].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 8);
  const total = (rows ?? []).reduce((s, r) => s + r.unitsSold, 0);
  const data = top.map((r) => ({ name: shortName(r.name), value: r.unitsSold, note: total ? formatPercent((r.unitsSold / total) * 100) : undefined }));
  return (
    <Panel title="Best sellers" description="Units sold · share of all units in view" className="xl:col-span-3">
      <ChartFrame height={data.length ? Math.max(160, data.length * 36 + 16) : 300} loading={loading} error={error} onRetry={onRetry} empty={!loading && data.length === 0} emptyTitle="No products match" emptyDescription="Try clearing filters or widening the date range.">
        <HBarChart data={data} format={(v) => `${formatNumber(v)} units`} valueLabel="Units sold" rowHeight={36} labelWidth={160} />
      </ChartFrame>
    </Panel>
  );
}

/** Lowest unit sales among published products (server-ranked) — candidates for promotion or markdown. */
export function WorstPerformersPanel({ rows, loading, error, onRetry }: Props) {
  const worst = (rows ?? []).slice(0, 6);
  return (
    <Panel flush title="Worst performers" description="Lowest units among published products" className="xl:col-span-2">
      {error ? (
        <ErrorState compact onRetry={onRetry} />
      ) : loading || !rows ? (
        <ul aria-busy="true" aria-label="Loading">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3 last:border-0">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3.5 w-12" />
            </li>
          ))}
        </ul>
      ) : worst.length === 0 ? (
        <EmptyState compact icon={TrendingDown} title="Nothing to flag" description="No published products match the current filters." />
      ) : (
        <ul>
          {worst.map((r) => (
            <li key={r.productId} className="flex items-center gap-3 border-b border-zinc-100 px-5 py-2.5 last:border-0">
              <ProductThumb src={r.image} alt={r.name} size={36} />
              <div className="min-w-0 flex-1">
                <Link to={`/products/${r.productId}`} className="block truncate text-[0.8125rem] font-semibold text-zinc-900 hover:underline">
                  {r.name}
                </Link>
                <div className="truncate text-xs text-zinc-500">
                  {formatNumber(r.views)} views · {formatNumber(r.stock)} in stock
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[0.8125rem] font-semibold text-zinc-900 tabular">{formatNumber(r.unitsSold)}</div>
                <div className="text-2xs text-zinc-500">units</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
