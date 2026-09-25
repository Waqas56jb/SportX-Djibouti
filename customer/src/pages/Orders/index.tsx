import { ArrowLeft, HelpCircle, Package, RefreshCw, Truck, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AccountSection } from '@/components/account/AccountLayout';
import { Button, ButtonLink, EmptyState, ErrorState, InlineAlert, Modal, SkeletonLoader, TextAreaField } from '@/components/common';
import { RichText } from '@/components/cart/RichText';
import { OrderCard } from '@/components/order/OrderCard';
import { AddressBlock, OrderItemsList, OrderStatusBadge, OrderTimeline, OrderTotals, PaymentSummary } from '@/components/order/OrderParts';
import { ROUTES } from '@/constants/routes';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useReorder } from '@/hooks/useReorder';
import { useT, type TKey } from '@/i18n';
import { friendlyError } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { toast } from '@/store/toastStore';
import type { Order } from '@/types';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime } from '@/utils/format';

const CLOSED: Order['status'][] = ['delivered', 'cancelled', 'refunded'];

const FILTERS: { key: string; label: TKey; match: (o: Order) => boolean }[] = [
  { key: 'all', label: 'orders.list.filters.all', match: () => true },
  { key: 'active', label: 'orders.list.filters.active', match: (o) => !CLOSED.includes(o.status) },
  { key: 'delivered', label: 'orders.list.filters.delivered', match: (o) => o.status === 'delivered' },
  { key: 'cancelled', label: 'orders.list.filters.cancelled', match: (o) => o.status === 'cancelled' || o.status === 'refunded' },
];

export function OrdersPage() {
  const { t } = useT();
  usePageMeta({ title: t('orders.list.pageTitle'), noindex: true });
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => orderService.listForUser({ limit: 50 }), [user?.id]);
  const reorder = useReorder();
  const [filter, setFilter] = useState('all');
  const visible = useMemo(() => (data ?? []).filter(FILTERS.find((f) => f.key === filter)!.match), [data, filter]);

  return (
    <AccountSection title={t('orders.list.title')} description={t('orders.list.description')}>
      <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label={t('orders.list.filterLabel')}>
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
              {t(f.label)}
              {data && <span className="ms-1.5 opacity-60">{n}</span>}
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
            title={filter === 'all' ? t('orders.list.emptyTitle') : t('orders.list.emptyFilteredTitle')}
            description={filter === 'all' ? t('orders.list.emptyBody') : t('orders.list.emptyFilteredBody')}
            action={filter === 'all' ? <ButtonLink to={ROUTES.shop}>{t('orders.list.startShopping')}</ButtonLink> : undefined}
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
  const { t } = useT();
  const { user } = useAuth();
  const { data: order, loading, error, reload, setData } = useAsync(() => orderService.getById(id), [id, user?.id]);
  const reorder = useReorder();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  usePageMeta({ title: order ? t('orders.detail.pageTitle', { number: order.number }) : t('orders.detail.pageTitleFallback'), noindex: true });

  const cancel = async () => {
    if (!order) return;
    setCancelling(true);
    setCancelError(null);
    try {
      setData(await orderService.cancel(order.id, reason));
      setCancelOpen(false);
      setReason('');
      toast.success(t('orders.detail.cancelledToast', { number: order.number }), { description: order.paymentStatus === 'paid' ? t('orders.detail.refundToast') : undefined });
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
        <EmptyState compact icon={<Package />} title={t('orders.detail.notFoundTitle')} description={t('orders.detail.notFoundBody')} action={<ButtonLink to={ROUTES.accountOrders}>{t('orders.detail.backToOrders')}</ButtonLink>} />
      </div>
    );
  }

  return (
    <div>
      <Link to={ROUTES.accountOrders} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t('orders.detail.allOrders')}
      </Link>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">{t('orders.detail.placed', { date: formatDate(order.createdAt, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
          <h1 className="heading-lg mt-2 break-words">
            <RichText text={t('orders.detail.title')} parts={{ number: <span className="ltr-text">{order.number}</span> }} />
          </h1>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status === 'cancelled' && (
        <InlineAlert tone="error" className="mt-6">
          {order.cancelledAt ? t('orders.detail.cancelledOn', { date: formatDate(order.cancelledAt) }) : t('orders.detail.cancelled')}
          {order.cancelReason ? ` ${t('orders.detail.cancelReason', { reason: order.cancelReason })}` : ''}
        </InlineAlert>
      )}
      {order.status === 'payment-pending' && order.paymentExpiresAt && (
        <InlineAlert tone="warning" className="mt-6">
          {t('orders.detail.awaitingPayment', { date: formatDateTime(order.paymentExpiresAt) })}
        </InlineAlert>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="border border-paper-200 bg-white p-5 sm:p-6" aria-labelledby="items-title">
            <h2 id="items-title" className="heading-sm">
              {t('orders.detail.items')}
            </h2>
            <OrderItemsList items={order.items} />
          </section>
          <section className="grid gap-6 border border-paper-200 bg-white p-5 sm:grid-cols-2 sm:p-6" aria-label={t('orders.detail.deliveryAndPayment')}>
            <div>
              {order.shipping.address ? (
                <AddressBlock address={order.shipping.address} title={order.shipping.method.id === 'pickup' ? t('orders.detail.storePickup') : t('orders.detail.shippingAddress')} />
              ) : (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]">{order.shipping.method.id === 'pickup' ? t('orders.detail.storePickup') : t('orders.detail.delivery')}</p>
              )}
              <p className="mt-3 text-xs text-ink-500">
                {order.shipping.method.name}
                {!CLOSED.includes(order.status) && order.shipping.expectedDelivery && ` · ${t('orders.detail.expected', { date: formatDate(order.shipping.expectedDelivery) })}`}
              </p>
              {(order.shipping.carrier || order.shipping.trackingNumber || order.shipping.shippedAt || order.shipping.deliveredAt) && (
                <dl className="mt-4 space-y-1.5 border-t border-paper-200 pt-4 text-sm">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
                    <Truck className="h-4 w-4" aria-hidden /> {t('orders.detail.shipment')}
                  </p>
                  {order.shipping.carrier && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-500">{t('orders.detail.carrier')}</dt>
                      <dd className="text-end font-medium">{order.shipping.carrier}</dd>
                    </div>
                  )}
                  {order.shipping.trackingNumber && (
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-ink-500">{t('orders.detail.trackingNumber')}</dt>
                      <dd className="ltr-text min-w-0 select-all break-all font-mono text-[13px] font-medium">{order.shipping.trackingNumber}</dd>
                    </div>
                  )}
                  {order.shipping.shippedAt && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-500">{t('orders.detail.shipped')}</dt>
                      <dd className="text-end">{formatDateTime(order.shipping.shippedAt)}</dd>
                    </div>
                  )}
                  {order.shipping.deliveredAt && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-500">{t('orders.detail.delivered')}</dt>
                      <dd className="text-end">{formatDateTime(order.shipping.deliveredAt)}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]">{t('orders.detail.payment')}</p>
              <PaymentSummary order={order} />
            </div>
          </section>
          <section className="border border-paper-200 bg-white p-5 sm:p-6" aria-labelledby="totals-title">
            <h2 id="totals-title" className="heading-sm mb-4">
              {t('orders.detail.paymentSummary')}
            </h2>
            <OrderTotals order={order} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="border border-paper-200 bg-white p-5 sm:p-6" aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="heading-sm mb-6">
              {CLOSED.includes(order.status) && order.status !== 'delivered' ? t('orders.detail.history') : t('orders.detail.tracking')}
            </h2>
            <OrderTimeline order={order} />
          </section>
          <div className="space-y-2">
            <Button variant="primary" fullWidth onClick={() => reorder(order)} leftIcon={<RefreshCw className="h-4 w-4" />}>
              {t('orders.detail.reorder')}
            </Button>
            <ButtonLink to={`${ROUTES.accountSupport}?order=${order.number}`} variant="outline" fullWidth leftIcon={<HelpCircle className="h-4 w-4" />}>
              {t('orders.detail.help')}
            </ButtonLink>
            {order.canCancel && (
              <Button variant="ghost" fullWidth onClick={() => setCancelOpen(true)} leftIcon={<XCircle className="h-4 w-4" />} className="hover:text-danger">
                {t('orders.detail.cancel')}
              </Button>
            )}
          </div>
        </aside>
      </div>

      <Modal open={cancelOpen} onClose={() => !cancelling && setCancelOpen(false)} title={t('orders.detail.cancelTitle', { number: order.number })} size="sm">
        <div className="space-y-5 px-5 py-6 sm:px-6">
          <p className="text-sm text-ink-600">
            {t('orders.detail.cancelBody')}
            {order.paymentStatus === 'paid' ? ` ${t('orders.detail.cancelRefund')}` : ''}
          </p>
          <TextAreaField label={t('orders.detail.reason')} optional rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('orders.detail.reasonPlaceholder')} />
          {cancelError && <InlineAlert tone="error">{cancelError}</InlineAlert>}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-paper-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>
            {t('orders.detail.keep')}
          </Button>
          <Button variant="primary" onClick={cancel} loading={cancelling} className="!border-danger !bg-danger">
            {t('orders.detail.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
