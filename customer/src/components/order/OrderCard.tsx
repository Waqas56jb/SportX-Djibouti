import { ArrowRight, RefreshCw, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, SmartImage } from '@/components/common';
import { orderPath } from '@/constants/routes';
import type { Order } from '@/types';
import { useT } from '@/i18n';
import { formatDate, formatPrice } from '@/utils/format';
import { OrderStatusBadge, PaymentStatusBadge } from './OrderParts';

export function OrderCard({ order, onReorder }: { order: Order; onReorder: (order: Order) => void }) {
  const { t } = useT();
  const count = order.items.length ? order.items.reduce((n, i) => n + i.quantity, 0) : order.itemsCount;
  const trackable = !['delivered', 'cancelled', 'refunded', 'refund-requested'].includes(order.status);
  const thumbs = order.items.length ? order.items.slice(0, 4).map((i) => ({ id: i.id, image: i.image, name: i.name })) : order.image ? [{ id: order.id, image: order.image, name: order.number }] : [];
  return (
    <article className="border border-paper-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-paper-200 px-5 py-4 sm:px-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
          <div>
            <dt className="text-2xs uppercase tracking-[0.12em] text-ink-500">{t('orders.card.order')}</dt>
            <dd className="font-semibold"><span className="ltr-text">{order.number}</span></dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-[0.12em] text-ink-500">{t('orders.card.placed')}</dt>
            <dd>{formatDate(order.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-[0.12em] text-ink-500">{t('orders.card.total')}</dt>
            <dd className="font-semibold tabular-nums">{formatPrice(order.total)}</dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-[0.12em] text-ink-500">{t('orders.card.payment')}</dt>
            <dd>
              <PaymentStatusBadge status={order.payment.status} />
            </dd>
          </div>
        </dl>
        <OrderStatusBadge status={order.status} />
      </header>
      <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex shrink-0 -space-x-3 rtl:space-x-reverse">
            {thumbs.map((i) => (
              <div key={i.id} className="relative h-16 w-14 overflow-hidden border-2 border-white bg-paper-100">
                <SmartImage src={i.image} alt={i.name} sizes="56px" maxWidth={320} wrapperClassName="absolute inset-0" />
              </div>
            ))}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-semibold">{order.items.length ? order.items.map((i) => i.name).join(', ') : `${order.shipping.method.name}`}</p>
            <p className="mt-0.5 text-xs text-ink-500">
              {t('common.labels.items', { count })}
              {trackable && order.shipping.expectedDelivery && ` · ${t('orders.card.expected', { date: formatDate(order.shipping.expectedDelivery, { day: 'numeric', month: 'short' }) })}`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          {trackable ? (
            <Link to={orderPath(order.id)} className="btn btn-sm btn-primary">
              <Truck className="h-4 w-4" aria-hidden /> {t('orders.card.track')}
            </Link>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onReorder(order)} leftIcon={<RefreshCw className="h-4 w-4" />}>
              {t('orders.card.reorder')}
            </Button>
          )}
          <Link to={orderPath(order.id)} className="btn btn-sm btn-outline">
            {t('orders.card.view')} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
