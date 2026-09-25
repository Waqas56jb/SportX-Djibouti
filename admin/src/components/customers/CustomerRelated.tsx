import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Heart, LifeBuoy, ShoppingBag, Star } from 'lucide-react';
import type { ProductListItem } from '@/types';
import { EmptyState, ErrorState, Panel, ProductThumb, Rating, SkeletonText, StatusBadge } from '@/components/common';
import { ORDER_STATUS, REVIEW_STATUS, TICKET_PRIORITY, TICKET_STATUS } from '@/constants/status';
import { orderService } from '@/services/orderService';
import { productService } from '@/services/productService';
import { reviewService } from '@/services/reviewService';
import { supportService } from '@/services/supportService';
import { useAsync } from '@/hooks/useAsync';
import { formatDate, formatMoney, formatRelative } from '@/utils/format';

function ViewAll({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-zinc-600 hover:text-zinc-950">
      {label} <ArrowUpRight size={14} aria-hidden />
    </Link>
  );
}

/** Loading / error / empty wrapper for small related-record lists. */
function ListBody<T>({ state, empty, children }: { state: { data: T[] | undefined; loading: boolean; error: Error | null; reload: () => Promise<void> }; empty: ReactNode; children: (rows: T[]) => ReactNode }) {
  if (state.loading) return <SkeletonText lines={4} className="p-5" />;
  if (state.error) return <ErrorState compact onRetry={() => void state.reload()} />;
  if (!state.data?.length) return <>{empty}</>;
  return <>{children(state.data)}</>;
}

export function RecentOrdersPanel({ customerId }: { customerId: string }) {
  const state = useAsync(() => orderService.getOrders({ customerId }), [customerId]);
  const count = state.data?.length ?? 0;
  return (
    <Panel title="Recent orders" description={state.data ? `${count} ${count === 1 ? 'order' : 'orders'} in total` : undefined} flush actions={count > 5 ? <ViewAll to={`/orders?search=${encodeURIComponent(state.data?.[0]?.customerEmail ?? '')}`} label="All orders" /> : undefined}>
      <ListBody state={state} empty={<EmptyState compact icon={ShoppingBag} title="No orders yet" description="This customer hasn’t placed an order." />}>
        {(rows) => (
          <ul className="divide-y divide-zinc-100">
            {rows.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-zinc-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 tabular">{o.number}</p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(o.createdAt)} · {o.itemsCount} {o.itemsCount === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <StatusBadge map={ORDER_STATUS} value={o.status} />
                  <span className="w-28 text-right text-sm font-semibold text-zinc-900 tabular">{formatMoney(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ListBody>
    </Panel>
  );
}

export function CustomerReviewsPanel({ customerId }: { customerId: string }) {
  const state = useAsync(() => reviewService.getReviews({ customerId }), [customerId]);
  return (
    <Panel title="Reviews" description={state.data ? `${state.data.length} written` : undefined} flush>
      <ListBody state={state} empty={<EmptyState compact icon={Star} title="No reviews" description="Reviews this customer writes will appear here." />}>
        {(rows) => (
          <ul className="divide-y divide-zinc-100">
            {rows.slice(0, 4).map((r) => (
              <li key={r.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Rating value={r.rating} />
                  <StatusBadge map={REVIEW_STATUS} value={r.status} />
                </div>
                <p className="mt-1.5 text-sm font-medium text-zinc-900">{r.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[0.8125rem] text-zinc-600">{r.body}</p>
                <p className="mt-1.5 text-xs text-zinc-500">
                  <Link to={`/products/${r.productId}`} className="font-medium text-zinc-700 hover:underline">
                    {r.productName}
                  </Link>{' '}
                  · {formatRelative(r.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ListBody>
    </Panel>
  );
}

export function CustomerTicketsPanel({ customerId }: { customerId: string }) {
  const state = useAsync(() => supportService.getTickets({ customerId }), [customerId]);
  return (
    <Panel title="Support tickets" description={state.data ? `${state.data.length} total` : undefined} flush>
      <ListBody state={state} empty={<EmptyState compact icon={LifeBuoy} title="No support tickets" description="This customer hasn’t contacted support." />}>
        {(rows) => (
          <ul className="divide-y divide-zinc-100">
            {rows.slice(0, 4).map((t) => (
              <li key={t.id}>
                <Link to={`/support/${t.id}`} className="block px-5 py-3 transition-colors hover:bg-zinc-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-500 tabular">{t.number}</span>
                    <StatusBadge map={TICKET_STATUS} value={t.status} />
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-zinc-900">{t.subject}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                    <StatusBadge map={TICKET_PRIORITY} value={t.priority} dot={false} /> Updated {formatRelative(t.updatedAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ListBody>
    </Panel>
  );
}

async function loadWishlist(ids: string[]): Promise<ProductListItem[]> {
  const res = await Promise.allSettled(ids.map((id) => productService.getProduct(id)));
  return res.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

export function WishlistPanel({ productIds }: { productIds: string[] }) {
  const key = productIds.join(',');
  const state = useAsync(() => loadWishlist(productIds), [key]);
  return (
    <Panel title="Wishlist" description={`${productIds.length} saved ${productIds.length === 1 ? 'product' : 'products'}`} flush>
      <ListBody state={state} empty={<EmptyState compact icon={Heart} title="Wishlist is empty" />}>
        {(rows) => (
          <ul className="divide-y divide-zinc-100">
            {rows.map((p) => {
              const img = [...p.images].sort((a, b) => a.position - b.position)[0];
              return (
                <li key={p.id}>
                  <Link to={`/products/${p.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50">
                    <ProductThumb src={img?.url} alt={p.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                      <p className="truncate text-xs text-zinc-500">{p.brandName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-900 tabular">{formatMoney(p.price)}</p>
                      {p.stockStatus !== 'in_stock' && <p className="text-xs font-medium text-amber-700">{p.stockStatus === 'low_stock' ? 'Low stock' : 'Out of stock'}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </ListBody>
    </Panel>
  );
}

