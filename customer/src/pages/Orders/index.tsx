import { ArrowLeft, HelpCircle, Package, RefreshCw, Truck, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AccountSection } from '@/components/account/AccountLayout';
import { Button, ButtonLink, EmptyState, ErrorState, InlineAlert, Modal, SkeletonLoader, TextAreaField } from '@/components/common';
import { OrderCard } from '@/components/order/OrderCard';
import { AddressBlock, OrderItemsList, OrderStatusBadge, OrderTimeline, OrderTotals, PaymentSummary } from '@/components/order/OrderParts';
import { ROUTES } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useReorder } from '@/hooks/useReorder';
import { friendlyError } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { toast } from '@/store/toastStore';
import type { Order } from '@/types';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime } from '@/utils/format';

const CLOSED: Order['status'][] = ['delivered', 'cancelled', 'refunded'];

const FILTERS: { key: string; label: string; match: (o: Order) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'active', label: 'In progress', match: (o) => !CLOSED.includes(o.status) },
  { key: 'delivered', label: 'Delivered', match: (o) => o.status === 'delivered' },
  { key: 'cancelled', label: 'Cancelled', match: (o) => o.status === 'cancelled' || o.status === 'refunded' },
];

export function OrdersPage() {
  usePageMeta({ title: 'My Orders', noindex: true });
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => orderService.listForUser({ limit: 50 }), [user?.id]);
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
  const { data: order, loading, error, reload, setData } = useAsync(() => orderService.getById(id), [id, user?.id]);
  const reorder = useReorder();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  usePageMeta({ title: order ? `Order ${order.number}` : 'Order', noindex: true });

  const cancel = async () => {
    if (!order) return;
    setCancelling(true);
    setCancelError(null);
    try {
      setData(await orderService.cancel(order.id, reason));
      setCancelOpen(false);
      setReason('');
      toast.success(`Order ${order.number} cancelled`, { description: order.paymentStatus === 'paid' ? 'Your refund will be processed to the original payment method.' : undefined });
    } catch (err) {
      setCancelError(friendlyError(err));
    } finally {
      setCancelling(false);
    }
  };

  // The API only returns the signed-in customer's own orders (others are 404 → null).
  if (loading) return <SkeletonLoader rows={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!order) {
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

      {order.status === 'cancelled' && (
        <InlineAlert tone="error" className="mt-6">
          This order was cancelled{order.cancelledAt ? ` on ${formatDate(order.cancelledAt)}` : ''}.{order.cancelReason ? ` Reason: ${order.cancelReason}` : ''}
        </InlineAlert>
      )}
      {order.status === 'payment-pending' && order.paymentExpiresAt && (
        <InlineAlert tone="warning" className="mt-6">
          Awaiting payment — complete it before {formatDateTime(order.paymentExpiresAt)} or the order will be released.
        </InlineAlert>
      )}

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
              {order.shipping.address ? (
                <AddressBlock address={order.shipping.address} title={order.shipping.method.id === 'pickup' ? 'Store pickup' : 'Shipping address'} />
              ) : (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]">{order.shipping.method.id === 'pickup' ? 'Store pickup' : 'Delivery'}</p>
              )}
              <p className="mt-3 text-xs text-ink-500">
                {order.shipping.method.name}
                {!CLOSED.includes(order.status) && order.shipping.expectedDelivery && ` · Expected ${formatDate(order.shipping.expectedDelivery)}`}
              </p>
              {(order.shipping.carrier || order.shipping.trackingNumber || order.shipping.shippedAt || order.shipping.deliveredAt) && (
                <dl className="mt-4 space-y-1.5 border-t border-paper-200 pt-4 text-sm">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
                    <Truck className="h-4 w-4" aria-hidden /> Shipment
                  </p>
                  {order.shipping.carrier && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-500">Carrier</dt>
                      <dd className="font-medium">{order.shipping.carrier}</dd>
                    </div>
                  )}
                  {order.shipping.trackingNumber && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-500">Tracking number</dt>
                      <dd className="select-all font-mono text-[13px] font-medium">{order.shipping.trackingNumber}</dd>
                    </div>
                  )}
                  {order.shipping.shippedAt && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-500">Shipped</dt>
                      <dd>{formatDateTime(order.shipping.shippedAt)}</dd>
                    </div>
                  )}
                  {order.shipping.deliveredAt && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-500">Delivered</dt>
                      <dd>{formatDateTime(order.shipping.deliveredAt)}</dd>
                    </div>
                  )}
                </dl>
              )}
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
              {CLOSED.includes(order.status) && order.status !== 'delivered' ? 'Order history' : 'Tracking'}
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
            {order.canCancel && (
              <Button variant="ghost" fullWidth onClick={() => setCancelOpen(true)} leftIcon={<XCircle className="h-4 w-4" />} className="hover:text-danger">
                Cancel order
              </Button>
            )}
          </div>
        </aside>
      </div>

      <Modal open={cancelOpen} onClose={() => !cancelling && setCancelOpen(false)} title={`Cancel order ${order.number}?`} size="sm">
        <div className="space-y-5 px-5 py-6 sm:px-6">
          <p className="text-sm text-ink-600">
            Your items will be released and you won’t be charged.{order.paymentStatus === 'paid' ? ' The amount you paid will be refunded to your original payment method.' : ''}
          </p>
          <TextAreaField label="Reason" optional rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell us why (optional)" />
          {cancelError && <InlineAlert tone="error">{cancelError}</InlineAlert>}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-paper-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>
            Keep order
          </Button>
          <Button variant="primary" onClick={cancel} loading={cancelling} className="!border-danger !bg-danger">
            Cancel order
          </Button>
        </div>
      </Modal>
    </div>
  );
}
