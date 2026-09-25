import type { Order, OrderStatus } from '@/types';
import { ORDER_TRANSITIONS, isOfflinePayment } from '@/services/orderService';
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, SHIPPING_STATUS } from '@/constants/status';
import { formatDateTime } from '@/utils/format';
import type { CsvColumn } from '@/utils/csv';

/** Verb used on buttons/menus for moving an order to a status. */
export const STATUS_ACTION_LABEL: Record<OrderStatus, string> = {
  pending: 'Mark as pending',
  payment_pending: 'Mark awaiting payment',
  payment_confirmed: 'Confirm payment',
  processing: 'Mark as processing',
  packed: 'Mark as packed',
  shipped: 'Mark as shipped',
  out_for_delivery: 'Mark out for delivery',
  delivered: 'Mark as delivered',
  cancelled: 'Cancel order',
  refund_requested: 'Open refund request',
  refunded: 'Mark as refunded',
};

/** Manual transitions for this order: the server's list on detail views, a client mirror on list rows. */
const transitionsOf = (o: Pick<Order, 'status' | 'allowedTransitions'>): OrderStatus[] => o.allowedTransitions ?? ORDER_TRANSITIONS[o.status];

/** Valid forward/backward moves excluding cancellation (which has its own destructive action). */
export const nextStatuses = (o: Pick<Order, 'status' | 'allowedTransitions'>): OrderStatus[] => transitionsOf(o).filter((s) => s !== 'cancelled');
export const canTransition = (o: Pick<Order, 'status' | 'allowedTransitions'>, to: OrderStatus) => transitionsOf(o).includes(to);
export const canCancel = (o: Pick<Order, 'status' | 'allowedTransitions'>) => canTransition(o, 'cancelled');
export const refundable = (o: Pick<Order, 'payment'>) => Math.max(0, o.payment.amount - o.payment.refundedAmount);
/** Refunds need a captured payment with a remaining balance (server: payment PAID or PARTIALLY_REFUNDED). */
export const canRefund = (o: Pick<Order, 'payment'>) => ['paid', 'partially_refunded'].includes(o.payment.status) && refundable(o) > 0;
/** Staff may set payment status only for offline methods (COD / bank transfer) that are not yet settled. */
export const canSetPayment = (o: Pick<Order, 'payment' | 'status'>) =>
  isOfflinePayment(o.payment.method) && ['pending', 'failed'].includes(o.payment.status) && !['cancelled', 'refunded'].includes(o.status);

export type DatePreset = '' | 'today' | '7d' | '30d' | 'custom';
export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: '', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
];

/** Resolve a date preset (or custom YYYY-MM-DD bounds) to ISO from/to. */
export function resolveRange(preset: string, from: string, to: string): { from?: string; to?: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (preset === 'today') return { from: start.toISOString() };
  if (preset === '7d') return { from: new Date(start.getTime() - 6 * 86_400_000).toISOString() };
  if (preset === '30d') return { from: new Date(start.getTime() - 29 * 86_400_000).toISOString() };
  if (preset === 'custom')
    return {
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    };
  return {};
}

export const ORDER_CSV: CsvColumn<Order>[] = [
  { header: 'Order', value: (o) => o.number },
  { header: 'Date', value: (o) => formatDateTime(o.createdAt) },
  { header: 'Customer', value: (o) => o.customerName },
  { header: 'Email', value: (o) => o.customerEmail },
  { header: 'Phone', value: (o) => o.customerPhone },
  { header: 'Items', value: (o) => o.itemsCount },
  { header: 'Total', value: (o) => o.total },
  { header: 'Currency', value: (o) => o.currency },
  { header: 'Payment method', value: (o) => PAYMENT_METHOD[o.payment.method] },
  { header: 'Payment status', value: (o) => PAYMENT_STATUS[o.payment.status]?.label ?? o.payment.status },
  { header: 'Refunded', value: (o) => o.payment.refundedAmount },
  { header: 'Order status', value: (o) => ORDER_STATUS[o.status]?.label ?? o.status },
  { header: 'Shipping status', value: (o) => SHIPPING_STATUS[o.shipping.status]?.label ?? o.shipping.status },
  { header: 'Shipping method', value: (o) => o.shipping.method },
];
