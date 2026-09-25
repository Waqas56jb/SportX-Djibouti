import { ArrowLeft, HelpCircle, Package, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AccountSection } from '@/components/account/AccountLayout';
import { Button, ButtonLink, EmptyState, ErrorState, SkeletonLoader } from '@/components/common';
import { OrderCard } from '@/components/order/OrderCard';
import { AddressBlock, OrderItemsList, OrderStatusBadge, OrderTimeline, OrderTotals, PaymentSummary } from '@/components/order/OrderParts';
import { ROUTES } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useReorder } from '@/hooks/useReorder';
import { orderService } from '@/services';
import type { Order } from '@/types';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

const FILTERS: { key: string; label: string; match: (o: Order) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'active', label: 'In progress', match: (o) => !['delivered', 'cancelled'].includes(o.status) },
  { key: 'delivered', label: 'Delivered', match: (o) => o.status === 'delivered' },
  { key: 'cancelled', label: 'Cancelled', match: (o) => o.status === 'cancelled' },
];

export function OrdersPage() {
  usePageMeta({ title: 'My Orders', noindex: true });
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => orderService.listForUser(user!.id, user!.email), [user?.id]);
  const reorder = useReorder();
  const [filter, setFilter] = useState('all');
  const visible = useMemo(() => (data ?? []).filter(FILTERS.find((f) => f.key === filter)!.match), [data, filter]);

  return (
    <AccountSection title="Orders" description="Track, review and reorder your purchases.">
      <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter orders">
        {FILTERS.map((f) => {
          const n = (data ?? []).filter(f.match).length;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn('min-h-[40px] shrink-0 rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.1em] transition-colors', filter === f.key ? 'border-ink bg-ink text-white' : 'border-paper-300 bg-white hover:border-ink')}
            >
              {f.label}
              {data && <span className="ml-1.5 opacity-60">{n}</span>}
            </button>
          );
        })}
      </div>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <SkeletonLoader rows={3} />
      ) : visible.length === 0 ? (
        <div className="border border-paper-200 bg-white">
          <EmptyState
            compact
            icon={<Package />}
            title={filter === 'all' ? 'No orders yet' : 'No orders here'}
            description={filter === 'all' ? 'Your orders will appear here once you check out.' : 'Try a different filter.'}
            action={filter === 'all' ? <ButtonLink to={ROUTES.shop}>Start shopping</ButtonLink> : undefined}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((o) => (
            <OrderCard key={o.id} order={o} onReorder={reorder} />
          ))}
        </div>
      )}
    </AccountSection>
  );
}

export function OrderDetailsPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data: order, loading, error, reload } = useAsync(() => orderService.getById(id), [id]);
  const reorder = useReorder();
  usePageMeta({ title: order ? `Order ${order.number}` : 'Order', noindex: true });

  const owned = order && user && (order.userId === user.id || (!order.userId && order.customer.email.toLowerCase() === user.email.toLowerCase()));

  if (loading) return <SkeletonLoader rows={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!order || !owned) {
    return (
      <div className="border border-paper-200 bg-white">
        <EmptyState compact icon={<Package />} title="Order not found" description="We couldn’t find this order on your account." action={<ButtonLink to={ROUTES.accountOrders}>Back to orders</ButtonLink>} />
      </div>
    );
  }

  return (
    <div>
      <Link to={ROUTES.accountOrders} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All orders
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Placed {formatDate(order.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="heading-lg mt-2">Order {order.number}</h1>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="border border-paper-200 bg-white p-5 sm:p-6" aria-labelledby="items-title">
            <h2 id="items-title" className="heading-sm">
              Items
            </h2>
            <OrderItemsList items={order.items} />
          </section>
          <section className="grid gap-6 border border-paper-200 bg-white p-5 sm:grid-cols-2 sm:p-6" aria-label="Delivery and payment">
            <div>
              <AddressBlock address={order.shipping.address} title={order.shipping.method.id === 'pickup' ? 'Store pickup' : 'Shipping address'} />
              <p className="mt-3 text-xs text-ink-500">
                {order.shipping.method.name}
                {order.status !== 'cancelled' && ` · Expected ${formatDate(order.shipping.expectedDelivery)}`}
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]">Payment</p>
              <PaymentSummary order={order} />
            </div>
          </section>
          <section className="border border-paper-200 bg-white p-5 sm:p-6" aria-labelledby="totals-title">
            <h2 id="totals-title" className="heading-sm mb-4">
              Payment summary
            </h2>
            <OrderTotals order={order} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="border border-paper-200 bg-white p-5 sm:p-6" aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="heading-sm mb-6">
              {order.status === 'cancelled' ? 'Order history' : 'Tracking'}
            </h2>
            <OrderTimeline order={order} />
          </section>
          <div className="space-y-2">
            <Button variant="primary" fullWidth onClick={() => reorder(order)} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Reorder
            </Button>
            <ButtonLink to={`${ROUTES.accountSupport}?order=${order.number}`} variant="outline" fullWidth leftIcon={<HelpCircle className="h-4 w-4" />}>
              Get help with this order
            </ButtonLink>
          </div>
        </aside>
      </div>
    </div>
  );
}
