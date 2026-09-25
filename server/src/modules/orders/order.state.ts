import type { PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { query, queryOne } from '../../config/database.js';
import { AppError, notFound } from '../../utils/errors.js';
import { emailService } from '../../services/email/email.service.js';
import { notificationService } from '../../services/notification/notification.service.js';
import { commitOrderStock, releaseOrderStock, restockOrder } from '../inventory/inventory.core.js';
import type { ActorType, OrderStatus, PaymentStatus, ShippingStatus } from '../../types/common.js';

/**
 * Centralised order lifecycle. Every status change in the system goes through `transitionOrder`,
 * which validates the move, writes status history and applies side effects (inventory, shipping,
 * payment, notifications) inside the caller's transaction.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAYMENT_CONFIRMED', 'PROCESSING', 'CANCELLED'],
  PAYMENT_PENDING: ['PAYMENT_CONFIRMED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['PROCESSING', 'CANCELLED', 'REFUND_REQUESTED'],
  PROCESSING: ['PACKED', 'CANCELLED', 'REFUND_REQUESTED'],
  PACKED: ['SHIPPED', 'PROCESSING', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['REFUND_REQUESTED', 'REFUNDED'],
  REFUND_REQUESTED: ['REFUNDED', 'DELIVERED', 'PROCESSING'],
  CANCELLED: [],
  REFUNDED: [],
};

/** Statuses a staff member may set directly. PAYMENT_CONFIRMED/REFUNDED come from the payment and refund workflows. */
export const MANUAL_STATUSES: OrderStatus[] = ['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUND_REQUESTED'];

/** Customers may cancel until the order is being prepared. */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['PENDING', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED'];

const SHIPPING_FOR: Partial<Record<OrderStatus, ShippingStatus>> = {
  PACKED: 'PACKED',
  SHIPPED: 'SHIPPED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
};

const CUSTOMER_MESSAGES: Partial<Record<OrderStatus, { type: 'PAYMENT_CONFIRMED' | 'ORDER_PROCESSING' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED' | 'ORDER_CANCELLED' | 'REFUND_PROCESSED'; title: string; email?: Parameters<typeof emailService.queue>[0] }>> = {
  PAYMENT_CONFIRMED: { type: 'PAYMENT_CONFIRMED', title: 'Payment confirmed', email: 'payment_confirmation' },
  PROCESSING: { type: 'ORDER_PROCESSING', title: 'Your order is being prepared' },
  SHIPPED: { type: 'ORDER_SHIPPED', title: 'Your order has shipped', email: 'order_shipped' },
  DELIVERED: { type: 'ORDER_DELIVERED', title: 'Your order was delivered', email: 'order_delivered' },
  CANCELLED: { type: 'ORDER_CANCELLED', title: 'Your order was cancelled', email: 'order_cancelled' },
  REFUNDED: { type: 'REFUND_PROCESSED', title: 'Your refund was processed', email: 'refund_processed' },
};

export interface OrderRowForState {
  id: string;
  order_number: string;
  user_id: string | null;
  email: string;
  customer_first_name: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  grand_total: number;
  refunded_total: number;
  currency: string;
}

export async function lockOrder(tx: PoolClient, orderId: string): Promise<OrderRowForState> {
  const o = await queryOne<OrderRowForState>(
    `select id, order_number, user_id, email, customer_first_name, status, payment_status, payment_method, grand_total, refunded_total, currency
       from public.orders where id = $1 and deleted_at is null for update`,
    [orderId],
    tx,
  );
  if (!o) throw notFound('Order');
  return o;
}

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from].includes(to);
}

export interface TransitionOptions {
  actorId?: string | null;
  actorType: ActorType;
  note?: string | null;
  cancelReason?: string | null;
  /** Skip business preconditions (used by the payment workflow itself). */
  system?: boolean;
}

/** Deferred effects to run after COMMIT (emails must not be sent for rolled-back changes). */
export type AfterCommit = Array<() => void>;

const money = (n: number, cur: string) => `${cur} ${n.toLocaleString('en-US')}`;

export async function transitionOrder(tx: PoolClient, orderId: string, to: OrderStatus, opts: TransitionOptions, after: AfterCommit = []): Promise<OrderRowForState> {
  const order = await lockOrder(tx, orderId);
  const from = order.status;
  if (from === to) return order;
  if (!canTransition(from, to)) {
    throw new AppError('ORDER_INVALID', `An order cannot move from ${from.replace(/_/g, ' ').toLowerCase()} to ${to.replace(/_/g, ' ').toLowerCase()}.`, { from, to, allowed: ORDER_TRANSITIONS[from] });
  }
  const cod = order.payment_method === 'CASH_ON_DELIVERY';
  if (!opts.system && ['PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(to) && ['FAILED', 'CANCELLED'].includes(order.payment_status)) {
    throw new AppError('ORDER_INVALID', 'The payment for this order failed. Resolve the payment before fulfilling it.');
  }
  if (!opts.system) {
    if (to === 'PAYMENT_CONFIRMED') throw new AppError('ORDER_INVALID', 'Payment confirmation comes from the payment provider or the payment-status workflow.');
    if (to === 'REFUNDED') throw new AppError('ORDER_INVALID', 'Use the refund workflow to refund an order.');
    if (['PROCESSING', 'PACKED', 'SHIPPED'].includes(to) && !cod && order.payment_status !== 'PAID' && order.payment_status !== 'PARTIALLY_REFUNDED') {
      throw new AppError('ORDER_INVALID', 'This order has not been paid yet.');
    }
  }

  // ─── Side effects ────────────────────────────────────────────────────────
  if (to === 'PAYMENT_CONFIRMED') await commitOrderStock(tx, orderId);
  if (to === 'SHIPPED') await commitOrderStock(tx, orderId); // COD orders decrement stock when they leave the store

  const shippingStatus = SHIPPING_FOR[to];
  if (shippingStatus) {
    await query(
      `update public.shipping set status = $2::public.shipping_status,
              shipped_at = case when $2::public.shipping_status = 'SHIPPED' then coalesce(shipped_at, now()) else shipped_at end,
              delivered_at = case when $2::public.shipping_status = 'DELIVERED' then now() else delivered_at end
        where order_id = $1`,
      [orderId, shippingStatus],
      tx,
    );
  }

  if (to === 'DELIVERED' && cod && order.payment_status === 'PENDING') {
    // Cash collected by the courier.
    await query(`update public.payments set status = 'PAID', paid_at = now() where order_id = $1 and status = 'PENDING'`, [orderId], tx);
    await query(
      `insert into public.payment_status_history (payment_id, status, note) select id, 'PAID', 'Cash collected on delivery' from public.payments where order_id = $1 and status = 'PAID'`,
      [orderId],
      tx,
    );
    await query(`update public.orders set payment_status = 'PAID' where id = $1`, [orderId], tx);
  }

  if (to === 'CANCELLED') {
    const paid = ['PAID', 'PARTIALLY_REFUNDED'].includes(order.payment_status);
    if (paid) await restockOrder(tx, orderId, 'ORDER_CANCELLED', opts.actorId);
    else await releaseOrderStock(tx, orderId);
    if (['PENDING', 'AUTHORIZED'].includes(order.payment_status)) {
      await query(`update public.payments set status = 'CANCELLED' where order_id = $1 and status in ('PENDING', 'AUTHORIZED')`, [orderId], tx);
      await query(`update public.orders set payment_status = 'CANCELLED' where id = $1`, [orderId], tx);
    }
    await query(`update public.orders set cancelled_at = now(), cancel_reason = $2 where id = $1`, [orderId, opts.cancelReason ?? opts.note ?? null], tx);
  }

  await query(`update public.orders set status = $2::public.order_status,
            shipping_status = coalesce((select s.status from public.shipping s where s.order_id = $1), shipping_status),
            payment_expires_at = case when $2::public.order_status = 'PAYMENT_PENDING' then payment_expires_at else null end
      where id = $1`, [orderId, to], tx);
  await query(`insert into public.order_status_history (order_id, status, note, changed_by, actor_type) values ($1, $2, $3, $4, $5)`, [orderId, to, opts.note ?? null, opts.actorId ?? null, opts.actorType], tx);

  // ─── Notifications (row in-transaction; email after commit) ─────────────
  const msg = CUSTOMER_MESSAGES[to];
  if (msg && order.user_id) {
    await notificationService.toUser(order.user_id, { type: msg.type, title: msg.title, message: `Order ${order.order_number}`, link: `/account/orders/${order.id}`, data: { orderId } }, tx);
  }
  if (msg?.email) {
    const email = msg.email;
    const tracking = to === 'SHIPPED' ? (await queryOne<{ tracking_number: string | null }>(`select tracking_number from public.shipping where order_id = $1`, [orderId], tx))?.tracking_number : null;
    after.push(() =>
      emailService.queue(email, order.email, {
        firstName: order.customer_first_name,
        orderNumber: order.order_number,
        total: money(order.grand_total, order.currency),
        amount: money(order.refunded_total, order.currency),
        reason: opts.cancelReason ?? undefined,
        trackingNumber: tracking ?? undefined,
        link: `${env.FRONTEND_URL}/account/orders/${order.id}`,
      }),
    );
  }
  if (to === 'REFUND_REQUESTED') {
    await notificationService.toStaff({ type: 'REFUND_REQUESTED', title: `Refund requested on ${order.order_number}`, message: opts.note ?? 'A refund was requested.', link: `/orders/${order.id}` }, tx);
  }
  return { ...order, status: to };
}

export function runAfterCommit(after: AfterCommit) {
  for (const fn of after) fn();
}
