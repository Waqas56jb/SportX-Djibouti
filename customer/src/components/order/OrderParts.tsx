import { Check, Circle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, SmartImage, type BadgeTone } from '@/components/common';
import { ORDER_EXCEPTION_STATUSES, ORDER_FLOW, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/constants/labels';
import { productPath } from '@/constants/routes';
import type { Order, OrderItem, OrderStatus, PaymentStatus } from '@/types';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime, formatPrice } from '@/utils/format';
import { SummaryRow } from '@/components/cart';
import { RichText } from '@/components/cart/RichText';
import { useT } from '@/i18n';

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending: 'neutral',
  'payment-pending': 'warning',
  'payment-confirmed': 'neutral',
  processing: 'warning',
  packed: 'warning',
  shipped: 'dark',
  'out-for-delivery': 'accent',
  delivered: 'success',
  cancelled: 'danger',
  'refund-requested': 'warning',
  refunded: 'neutral',
};

const PAYMENT_TONE: Record<PaymentStatus, BadgeTone> = {
  pending: 'warning',
  authorized: 'warning',
  paid: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  refunded: 'neutral',
  'partially-refunded': 'neutral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot>
      {ORDER_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONE[status] ?? 'neutral'}>{PAYMENT_STATUS_LABELS[status] ?? status}</Badge>;
}

/** Vertical fulfilment timeline: completed, current and upcoming stages. */
export function OrderTimeline({ order }: { order: Order }) {
  const { t } = useT();
  if (ORDER_EXCEPTION_STATUSES.includes(order.status)) {
    return (
      <ol className="space-y-6">
        {order.timeline.map((e, idx) => (
          <li key={`${e.status}-${idx}`} className="flex gap-4">
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', e.status === 'cancelled' ? 'bg-danger text-white' : 'bg-ink text-white')}>
              {e.status === 'cancelled' ? <X className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
            </span>
            <div>
              <p className="text-sm font-semibold">{ORDER_STATUS_LABELS[e.status]}</p>
              <p className="text-xs text-ink-500">{formatDateTime(e.date)}</p>
            </div>
          </li>
        ))}
      </ol>
    );
  }
  // PAYMENT_PENDING sits between "placed" and "payment confirmed" on the pipeline.
  const currentIdx = order.status === 'payment-pending' ? 1 : Math.max(0, ORDER_FLOW.indexOf(order.status));
  return (
    <ol className="relative">
      {ORDER_FLOW.map((status, i) => {
        const event = [...order.timeline].reverse().find((e) => e.status === status || (status === 'pending' && e.status === 'payment-pending'));
        const done = i < currentIdx || (i === currentIdx && status === 'delivered');
        const current = i === currentIdx && status !== 'delivered';
        const last = i === ORDER_FLOW.length - 1;
        return (
          <li key={status} className="relative flex gap-4 pb-7 last:pb-0" aria-current={current ? 'step' : undefined}>
            {!last && <span className={cn('absolute start-4 top-8 h-[calc(100%-2rem)] w-px -translate-x-1/2 rtl:translate-x-1/2', i < currentIdx ? 'bg-ink' : 'bg-paper-300')} aria-hidden />}
            <span
              className={cn(
                'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                done ? 'border-ink bg-ink text-white' : current ? 'border-accent bg-white text-accent' : 'border-paper-300 bg-white text-paper-300',
              )}
            >
              {done ? <Check className="h-4 w-4" aria-hidden /> : <Circle className={cn('h-2.5 w-2.5 fill-current', current && 'animate-pulse')} aria-hidden />}
            </span>
            <div className="pt-1">
              <p className={cn('text-sm font-semibold', !done && !current && 'text-ink-500')}>{ORDER_STATUS_LABELS[status]}</p>
              <p className="text-xs text-ink-500">
                {event ? formatDateTime(event.date) : current ? (order.status === 'payment-pending' ? t('orders.parts.awaitingPayment') : t('orders.parts.inProgress')) : status === 'delivered' && order.shipping.expectedDelivery ? t('orders.parts.expected', { date: formatDate(order.shipping.expectedDelivery) }) : t('orders.parts.pending')}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderItemsList({ items, compact }: { items: OrderItem[]; compact?: boolean }) {
  const { t } = useT();
  return (
    <ul className="divide-y divide-paper-200">
      {items.map((i) => (
        <li key={i.id} className="flex gap-3 py-4 sm:gap-4">
          <Link to={productPath(i.slug)} className={cn('relative shrink-0 overflow-hidden bg-paper-100', compact ? 'w-14' : 'w-20')}>
            <div className="aspect-[4/5]">
              <SmartImage src={i.image} alt={i.name} sizes="80px" maxWidth={320} wrapperClassName="absolute inset-0" />
            </div>
          </Link>
          <div className="min-w-0 flex-1">
            <Link to={productPath(i.slug)} className="text-sm font-semibold hover:underline">
              {i.name}
            </Link>
            <p className="mt-1 text-xs text-ink-500">
              {t('orders.parts.itemMeta', { colour: i.color, size: i.size, quantity: i.quantity })}
            </p>
            <p className="mt-1 text-xs text-ink-500">{t('orders.parts.each', { price: formatPrice(i.unitPrice) })}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(i.lineTotal ?? i.unitPrice * i.quantity)}</p>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotals({ order }: { order: Order }) {
  const { t } = useT();
  return (
    <dl className="space-y-3">
      <SummaryRow label={t('common.labels.subtotal')} value={formatPrice(order.subtotal)} />
      {order.productDiscount > 0 && <SummaryRow label={t('orders.parts.promotions')} value={<span className="ltr-text">−{formatPrice(order.productDiscount)}</span>} accent />}
      {order.discount > 0 && <SummaryRow
          label={order.couponCode ? <RichText text={t('orders.parts.promoCodeWith')} parts={{ code: <span className="ltr-text">{order.couponCode}</span> }} /> : t('orders.parts.promoCode')}
          value={<span className="ltr-text">−{formatPrice(order.discount)}</span>}
          accent
        />}
      <SummaryRow label={t('orders.parts.shippingWith', { method: order.shipping.method.name })} value={order.shippingCost === 0 ? t('common.labels.free') : formatPrice(order.shippingCost)} />
      {order.tax > 0 && <SummaryRow label={t('orders.parts.tax')} value={formatPrice(order.tax)} />}
      <div className="divider !my-4" />
      <SummaryRow label={t('common.labels.total')} value={formatPrice(order.total)} strong />
      {order.refunded > 0 && <SummaryRow label={t('orders.parts.refunded')} value={<span className="ltr-text">−{formatPrice(order.refunded)}</span>} muted />}
    </dl>
  );
}

export function PaymentSummary({ order }: { order: Order }) {
  const { t } = useT();
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-ink-500">{t('orders.parts.method')}</span>
        <span className="text-end font-medium">{PAYMENT_METHOD_LABELS[order.payment.method] ?? order.payment.method}</span>
      </div>
      {order.payment.reference && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-500">{t('orders.parts.reference')}</span>
          <span className="ltr-text min-w-0 break-all font-medium">{order.payment.reference}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-ink-500">{t('orders.parts.status')}</span>
        <PaymentStatusBadge status={order.payment.status} />
      </div>
    </div>
  );
}

export function AddressBlock({ address, title }: { address: NonNullable<Order['shipping']['address']>; title?: string }) {
  return (
    <address className="text-sm not-italic leading-relaxed text-ink-600">
      {title && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink">{title}</p>}
      <span className="block font-medium text-ink">
        {address.firstName} {address.lastName}
      </span>
      {address.line1 && <span className="block">{address.line1}</span>}
      {address.line2 && <span className="block">{address.line2}</span>}
      <span className="block">
        {address.city}
        {address.postalCode ? `, ${address.postalCode}` : ''}
      </span>
      <span className="block">{address.country}</span>
      <span className="block"><span className="ltr-text">{address.phone}</span></span>
    </address>
  );
}
