import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Tag } from 'lucide-react';
import type { Order } from '@/types';
import { formatMoney } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Panel, ProductThumb } from '@/components/common';

function Row({ label, value, strong, muted, className }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', className)}>
      <dt className={cn('text-[0.8125rem]', strong ? 'font-semibold text-zinc-950' : 'text-zinc-600')}>{label}</dt>
      <dd className={cn('tabular', strong ? 'text-base font-semibold text-zinc-950' : muted ? 'text-[0.8125rem] text-zinc-500' : 'text-[0.8125rem] text-zinc-900')}>{value}</dd>
    </div>
  );
}

/** Line items and the financial breakdown of an order. */
export function OrderItemsPanel({ order }: { order: Order }) {
  const refunded = order.payment.refundedAmount;
  return (
    <Panel title="Items" description={`${order.itemsCount} item${order.itemsCount === 1 ? '' : 's'} in this order`} flush>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block print:block">
        <table className="w-full text-left">
          <caption className="sr-only">Order items</caption>
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/70 text-2xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              <th scope="col" className="py-2.5 pl-5 pr-3">
                Product
              </th>
              <th scope="col" className="px-3 py-2.5">
                SKU
              </th>
              <th scope="col" className="px-3 py-2.5 text-right">
                Qty
              </th>
              <th scope="col" className="px-3 py-2.5 text-right">
                Price
              </th>
              <th scope="col" className="py-2.5 pl-3 pr-5 text-right">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id} className="border-b border-zinc-100 last:border-0">
                <td className="py-3 pl-5 pr-3">
                  <div className="flex items-center gap-3">
                    <ProductThumb src={i.image} alt={i.productName} size={48} />
                    <div className="min-w-0">
                      <Link to={`/products/${i.productId}`} className="font-medium text-zinc-900 hover:underline">
                        {i.productName}
                      </Link>
                      <div className="text-xs text-zinc-500">{i.variantLabel}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap font-mono text-xs text-zinc-600">{i.sku}</td>
                <td className="px-3 py-3 text-right text-[0.8125rem] tabular">× {i.quantity}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-[0.8125rem] tabular text-zinc-700">{formatMoney(i.unitPrice)}</td>
                <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right text-[0.8125rem] font-semibold tabular text-zinc-950">{formatMoney(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <ul className="divide-y divide-zinc-100 sm:hidden print:hidden">
        {order.items.map((i) => (
          <li key={i.id} className="flex gap-3 p-4">
            <ProductThumb src={i.image} alt={i.productName} size={52} />
            <div className="min-w-0 flex-1">
              <Link to={`/products/${i.productId}`} className="block truncate text-sm font-medium text-zinc-900">
                {i.productName}
              </Link>
              <div className="text-xs text-zinc-500">{i.variantLabel}</div>
              <div className="font-mono text-xs text-zinc-500">{i.sku}</div>
              <div className="mt-1.5 flex justify-between text-[0.8125rem] tabular">
                <span className="text-zinc-600">
                  {i.quantity} × {formatMoney(i.unitPrice)}
                </span>
                <span className="font-semibold text-zinc-950">{formatMoney(i.subtotal)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-zinc-100 bg-zinc-50/40 px-5 py-4">
        <dl className="ml-auto max-w-sm">
          <Row label="Subtotal" value={formatMoney(order.subtotal)} />
          {order.discount > 0 && (
            <Row
              label={
                <span className="inline-flex items-center gap-1.5">
                  Discount
                  {order.couponCode && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-volt/30 px-1.5 py-0.5 font-mono text-2xs font-semibold text-ink-950">
                      <Tag size={10} aria-hidden /> {order.couponCode}
                    </span>
                  )}
                </span>
              }
              value={<span className="text-emerald-700">−{formatMoney(order.discount)}</span>}
            />
          )}
          <Row label="Shipping" value={order.shippingCost ? formatMoney(order.shippingCost) : 'Free'} />
          <Row label="Tax" value={formatMoney(order.tax)} muted={!order.tax} />
          <Row label="Total" value={formatMoney(order.total)} strong className="mt-1.5 border-t border-zinc-200 pt-3" />
          <Row label="Refunded" value={refunded ? <span className="text-red-600">−{formatMoney(refunded)}</span> : formatMoney(0)} muted={!refunded} />
          <Row label="Net" value={formatMoney(order.total - refunded)} strong />
        </dl>
      </div>
    </Panel>
  );
}
