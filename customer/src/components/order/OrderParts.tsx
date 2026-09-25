import { Check, Circle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, SmartImage, type BadgeTone } from '@/components/common';
import { ORDER_FLOW, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/constants/labels';
import { productPath } from '@/constants/routes';
import type { Order, OrderItem, OrderStatus, PaymentStatus } from '@/types';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime, formatPrice } from '@/utils/format';
import { SummaryRow } from '@/components/cart';

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  created: 'neutral',
  'payment-confirmed': 'neutral',
  processing: 'warning',
  packed: 'warning',
  shipped: 'dark',
  'out-for-delivery': 'accent',
  delivered: 'success',
  cancelled: 'danger',
};

const PAYMENT_TONE: Record<PaymentStatus, BadgeTone> = { pending: 'warning', paid: 'success', failed: 'danger', refunded: 'neutral' };

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONE[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

/** Vertical fulfilment timeline: completed, current and upcoming stages. */
export function OrderTimeline({ order }: { order: Order }) {
  if (order.status === 'cancelled') {
    return (
      <ol className="space-y-6">
        {order.timeline.map((e) => (
          <li key={e.status} className="flex gap-4">
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
  const currentIdx = ORDER_FLOW.indexOf(order.status);
  return (
    <ol className="relative">
      {ORDER_FLOW.map((status, i) => {
        const event = order.timeline.find((t) => t.status === status);
        const done = i < currentIdx || (i === currentIdx && status === 'delivered');
        const current = i === currentIdx && status !== 'delivered';
        const last = i === ORDER_FLOW.length - 1;
        return (
          <li key={status} className="relative flex gap-4 pb-7 last:pb-0" aria-current={current ? 'step' : undefined}>
            {!last && <span className={cn('absolute left-4 top-8 h-[calc(100%-2rem)] w-px -translate-x-1/2', i < currentIdx ? 'bg-ink' : 'bg-paper-300')} aria-hidden />}
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
                {event ? formatDateTime(event.date) : current ? 'In progress' : status === 'delivered' ? `Expected ${formatDate(order.shipping.expectedDelivery)}` : 'Pending'}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderItemsList({ items, compact }: { items: OrderItem[]; compact?: boolean }) {
  return (
    <ul className="divide-y divide-paper-200">
      {items.map((i) => (
        <li key={i.id} className="flex gap-4 py-4">
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
              {i.color} · Size {i.size} · Qty {i.quantity}
            </p>
            <p className="mt-1 text-xs text-ink-500">{formatPrice(i.unitPrice)} each</p>
          </div>
          <p className="text-sm font-semibold tabular-nums">{formatPrice(i.unitPrice * i.quantity)}</p>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotals({ order }: { order: Order }) {
  return (
    <dl className="space-y-3">
      <SummaryRow label="Subtotal" value={formatPrice(order.subtotal)} />
      {order.discount > 0 && <SummaryRow label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`−${formatPrice(order.discount)}`} accent />}
      <SummaryRow label={`Shipping · ${order.shipping.method.name}`} value={order.shippingCost === 0 ? 'Free' : formatPrice(order.shippingCost)} />
      <div className="divider !my-4" />
      <SummaryRow label="Total" value={formatPrice(order.total)} strong />
    </dl>
  );
}

export function PaymentSummary({ order }: { order: Order }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-ink-500">Method</span>
        <span className="font-medium">{PAYMENT_METHOD_LABELS[order.payment.method]}</span>
      </div>
      {order.payment.reference && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-500">Reference</span>
          <span className="font-medium">{order.payment.reference}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-ink-500">Status</span>
        <PaymentStatusBadge status={order.payment.status} />
      </div>
    </div>
  );
}

export function AddressBlock({ address, title }: { address: Order['shipping']['address']; title?: string }) {
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
      <span className="block">{address.phone}</span>
    </address>
  );
}
