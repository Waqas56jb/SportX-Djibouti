import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Heart, LifeBuoy, ShoppingBag, Star } from 'lucide-react';
import type { CustomerWishlistItem } from '@/types';
import { EmptyState, ErrorState, Panel, ProductThumb, Rating, SkeletonText, StatusBadge } from '@/components/common';
import { ORDER_STATUS, REVIEW_STATUS, TICKET_PRIORITY, TICKET_STATUS } from '@/constants/status';
import { customerService } from '@/services/customerService';
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
function ListBody<T>({ state, empty, children }: { state: { data: { data: T[] } | undefined; loading: boolean; error: Error | null; reload: () => Promise<void> }; empty: ReactNode; children: (rows: T[]) => ReactNode }) {
  if (state.loading) return <SkeletonText lines={4} className="p-5" />;
  if (state.error) return <ErrorState compact onRetry={() => void state.reload()} />;
  if (!state.data?.data.length) return <>{empty}</>;
  return <>{children(state.data.data)}</>;
}

export function RecentOrdersPanel({ customerId, email }: { customerId: string; email?: string }) {
  const state = useAsync(() => customerService.getCustomerOrders(customerId, { pageSize: 5 }), [customerId]);
  const count = state.data?.total ?? 0;
  return (
    <Panel
      title="Recent orders"
      description={state.data ? `${count} ${count === 1 ? 'order' : 'orders'} in total` : undefined}
      flush
      actions={count > 5 && email ? <ViewAll to={`/orders?search=${encodeURIComponent(email)}`} label="All orders" /> : undefined}
    >
      <ListBody state={state} empty={<EmptyState compact icon={ShoppingBag} title="No orders yet" description="This customer hasn’t placed an order." />}>
        {(rows) => (
          <ul className="divide-y divide-zinc-100">
            {rows.map((o) => (
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
  const state = useAsync(() => reviewService.getReviews({ pageSize: 4, filters: { customerId } }), [customerId]);
  return (
    <Panel title="Reviews" description={state.data ? `${state.data.total} written` : undefined} flush>
      <ListBody state={state} empty={<EmptyState compact icon={Star} title="No reviews" description="Reviews this customer writes will appear here." />}>
        {(rows) => (
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => (
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
  const state = useAsync(() => supportService.getTickets({ pageSize: 4, filters: { customerId } }), [customerId]);
  return (
    <Panel title="Support tickets" description={state.data ? `${state.data.total} total` : undefined} flush>
      <ListBody state={state} empty={<EmptyState compact icon={LifeBuoy} title="No support tickets" description="This customer hasn’t contacted support." />}>
        {(rows) => (
          <ul className="divide-y divide-zinc-100">
            {rows.map((t) => (
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

/** Wishlist items come with the customer detail (GET /admin/customers/:id). */
export function WishlistPanel({ items, count }: { items: CustomerWishlistItem[]; count: number }) {
  return (
    <Panel title="Wishlist" description={`${count} saved ${count === 1 ? 'product' : 'products'}`} flush>
      {items.length === 0 ? (
        <EmptyState compact icon={Heart} title="Wishlist is empty" />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {items.map((p) => (
            <li key={p.productId}>
              <Link to={`/products/${p.productId}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50">
                <ProductThumb src={p.image} alt={p.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                  {p.addedAt && <p className="truncate text-xs text-zinc-500">Saved {formatRelative(p.addedAt)}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-zinc-900 tabular">{formatMoney(p.price)}</p>
                  {p.status !== 'active' && <p className="text-xs font-medium text-amber-700">{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
