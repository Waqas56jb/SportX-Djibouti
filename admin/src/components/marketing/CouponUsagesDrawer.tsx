import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import type { Coupon } from '@/types';
import { EmptyState, ErrorState, Skeleton } from '@/components/common';
import { Pagination } from '@/components/tables';
import { Drawer } from '@/components/modals/Overlay';
import { useAsync } from '@/hooks/useAsync';
import { discountService } from '@/services/discountService';
import { formatDateTime, formatMoney, formatNumber } from '@/utils/format';
import { CopyCode, UsageMeter } from './MarketingParts';
import { discountLabel } from './utils';

const PAGE_SIZE = 10;

/** Coupon detail (fresh from GET /coupons/:id) with its paginated redemption history. */
export function CouponUsagesDrawer({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const id = coupon?.id;
  useEffect(() => setPage(1), [id]);

  const detail = useAsync(() => (id ? discountService.getCoupon(id) : Promise.resolve(undefined)), [id]);
  const usages = useAsync(() => (id ? discountService.getCouponUsages(id, { page, pageSize: PAGE_SIZE }) : Promise.resolve(undefined)), [id, page]);
  const c = detail.data ?? coupon ?? undefined;

  return (
    <Drawer open={Boolean(coupon)} onClose={onClose} width="lg" title={c ? `Redemptions · ${c.code}` : 'Redemptions'} description="Orders that used this coupon, most recent first.">
      {c && (
        <div className="mb-5 grid gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 sm:grid-cols-3">
          <div className="min-w-0">
            <div className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Code</div>
            <CopyCode code={c.code} className="mt-1" />
            <div className="mt-1 text-xs text-zinc-500">{discountLabel(c.type, c.value)} off</div>
          </div>
          <div>
            <div className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Usage</div>
            <UsageMeter count={c.usageCount} limit={c.usageLimit} className="mt-1" />
          </div>
          <div>
            <div className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Total discounted</div>
            <div className="mt-1 font-display text-xl font-bold tabular text-zinc-950">{detail.loading && !detail.data ? <Skeleton className="h-6 w-20" /> : formatMoney(c.discountTotal ?? 0)}</div>
          </div>
        </div>
      )}

      {usages.error ? (
        <ErrorState onRetry={() => void usages.reload()} description="We couldn’t load the redemptions." />
      ) : usages.loading && !usages.data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !usages.data?.items.length ? (
        <EmptyState icon={Receipt} title="No redemptions yet" description="Orders placed with this code will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200/80">
          <ul className="divide-y divide-zinc-100" aria-label="Coupon redemptions">
            {usages.data.items.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[0.8125rem] font-medium text-zinc-900">
                    {u.orderId ? (
                      <Link to={`/orders/${u.orderId}`} className="hover:underline">
                        {u.orderNumber ?? 'Order'}
                      </Link>
                    ) : (
                      (u.orderNumber ?? 'Order')
                    )}
                    <span className="font-normal text-zinc-500"> · {u.customerName ?? u.email ?? 'Guest'}</span>
                  </div>
                  <div className="text-xs text-zinc-500 tabular">{formatDateTime(u.createdAt)}</div>
                </div>
                <div className="shrink-0 text-right text-xs tabular">
                  <div className="font-semibold text-zinc-950">−{formatMoney(u.discountAmount)}</div>
                  {u.orderTotal !== null && <div className="text-zinc-500">of {formatMoney(u.orderTotal)}</div>}
                </div>
              </li>
            ))}
          </ul>
          {usages.data.total > PAGE_SIZE && <Pagination page={page} pageCount={usages.data.totalPages} pageSize={PAGE_SIZE} total={usages.data.total} onPageChange={setPage} />}
        </div>
      )}
      {usages.data && usages.data.total > 0 && <p className="mt-3 text-xs text-zinc-500">{formatNumber(usages.data.total)} redemption{usages.data.total === 1 ? '' : 's'} in total.</p>}
    </Drawer>
  );
}
