import { Link, useNavigate } from 'react-router-dom';
import { Eye, PackageSearch, Pencil } from 'lucide-react';
import type { TopProduct } from '@/types';
import { usePermission } from '@/hooks/usePermission';
import { EmptyState, ErrorState, IconButton, Panel, ProductThumb, Skeleton } from '@/components/common';
import { formatMoney, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

const TH = 'px-3 py-2.5 text-2xs font-semibold uppercase tracking-[0.08em] text-zinc-500 whitespace-nowrap';

export function TopProductsPanel({ data, loading, error, onRetry, periodLabel, className }: { data: TopProduct[] | undefined; loading: boolean; error: Error | null; onRetry: () => void; periodLabel: string; className?: string }) {
  const canEdit = usePermission('products:edit');
  const navigate = useNavigate();

  return (
    <Panel
      flush
      title="Top products"
      description={`By revenue · ${periodLabel}`}
      actions={
        <Link to="/reports/products" className="text-xs font-semibold text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline">
          Product report
        </Link>
      }
      className={className ?? 'xl:col-span-3'}
    >
      {error ? (
        <ErrorState compact onRetry={onRetry} description="We couldn’t load top products. Please try again." />
      ) : !loading && (data?.length ?? 0) === 0 ? (
        <EmptyState compact icon={PackageSearch} title="No sales in this period" description="Top sellers will appear here once orders come in." />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <caption className="sr-only">Top products by revenue, {periodLabel}</caption>
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70">
                <th scope="col" className={cn(TH, 'pl-5')}>Product</th>
                <th scope="col" className={cn(TH, 'hidden lg:table-cell')}>Category</th>
                <th scope="col" className={cn(TH, 'text-right')}>Units</th>
                <th scope="col" className={cn(TH, 'text-right')}>Revenue</th>
                <th scope="col" className={cn(TH, 'hidden text-right md:table-cell')}>Stock</th>
                <th scope="col" className={cn(TH, 'hidden text-right sm:table-cell')}>Avg. price</th>
                <th scope="col" className={cn(TH, 'pr-4')}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading || !data
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0">
                      <td className="py-3 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-lg" />
                          <Skeleton className="h-3.5 w-40" />
                        </div>
                      </td>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className={cn('px-3 py-3', j === 0 && 'hidden lg:table-cell', j === 3 && 'hidden md:table-cell')}>
                          <Skeleton className="ml-auto h-3.5 w-14" />
                        </td>
                      ))}
                      <td />
                    </tr>
                  ))
                : data.map((p, idx) => (
                    <tr key={p.productId} className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80">
                      <td className="py-2.5 pl-5 pr-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-4 shrink-0 text-right text-xs font-semibold text-zinc-400 tabular">{idx + 1}</span>
                          <ProductThumb src={p.image} alt={p.name} size={40} />
                          <div className="min-w-0">
                            <Link to={`/products/${p.productId}`} className="block max-w-[260px] truncate text-[0.8125rem] font-semibold text-zinc-900 hover:underline">
                              {p.name}
                            </Link>
                            <div className="truncate text-xs text-zinc-500">{p.brand}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-3 text-[0.8125rem] text-zinc-600 lg:table-cell">{p.category}</td>
                      <td className="px-3 text-right text-[0.8125rem] font-medium text-zinc-800 tabular">{formatNumber(p.unitsSold)}</td>
                      <td className="px-3 text-right text-[0.8125rem] font-semibold text-zinc-900 tabular">{formatMoney(p.revenue)}</td>
                      <td className={cn('hidden px-3 text-right text-[0.8125rem] tabular md:table-cell', p.stock === 0 ? 'font-semibold text-red-600' : p.stock < 15 ? 'font-semibold text-amber-700' : 'text-zinc-600')}>
                        {p.stock === 0 ? 'Out' : formatNumber(p.stock)}
                      </td>
                      <td className="hidden px-3 text-right text-[0.8125rem] text-zinc-600 tabular sm:table-cell">{p.unitsSold ? formatMoney(Math.round(p.revenue / p.unitsSold)) : '—'}</td>
                      <td className="py-2 pr-4">
                        <div className="flex justify-end gap-0.5">
                          <IconButton size="sm" icon={Eye} label={`View ${p.name}`} onClick={() => navigate(`/products/${p.productId}`)} />
                          {canEdit && <IconButton size="sm" icon={Pencil} label={`Edit ${p.name}`} onClick={() => navigate(`/products/${p.productId}/edit`)} />}
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
