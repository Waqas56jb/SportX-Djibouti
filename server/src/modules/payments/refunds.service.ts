import { query, queryOne, withTransaction } from '../../config/database.js';
import { AppError, notFound } from '../../utils/errors.js';
import { randomToken } from '../../utils/http.js';
import { providerById } from '../../services/payment/payment.registry.js';
import { canTransition, lockOrder, runAfterCommit, transitionOrder, type AfterCommit } from '../orders/order.state.js';
import { restockOrder } from '../inventory/inventory.core.js';
import type { PaymentRow } from './payments.service.js';

export type RefundReason = 'CUSTOMER_REQUEST' | 'DAMAGED_ITEM' | 'WRONG_ITEM' | 'PAYMENT_ISSUE' | 'OTHER';

export interface RefundRequest {
  orderId: string;
  /** Omit for a full refund of the remaining amount. */
  amount?: number;
  reason: RefundReason;
  note?: string | null;
  restock: boolean;
  requestedBy: string | null;
  idempotencyKey?: string | null;
}

/**
 * Refund workflow: validate → record REQUESTED → call provider (outside the DB transaction) →
 * finalise atomically (refund COMPLETED/PROCESSING/FAILED, payment + order totals, order status,
 * optional restock). A payment is never marked refunded without the provider's confirmation.
 */
export const refundsService = {
  async refund(req: RefundRequest) {
    if (req.idempotencyKey) {
      const existing = await queryOne<{ id: string }>(`select id from public.refunds where idempotency_key = $1`, [req.idempotencyKey]);
      if (existing) return this.get(existing.id);
    }

    const prepared = await withTransaction(async (tx) => {
      const order = await lockOrder(tx, req.orderId);
      const payment = await queryOne<PaymentRow>(
        `select * from public.payments where order_id = $1 and status in ('PAID', 'PARTIALLY_REFUNDED') order by created_at desc limit 1 for update`,
        [req.orderId],
        tx,
      );
      if (!payment) throw new AppError('ORDER_INVALID', 'There is no captured payment to refund on this order.');
      const inFlight = await queryOne<{ total: number }>(`select coalesce(sum(amount), 0)::bigint as total from public.refunds where payment_id = $1 and status in ('REQUESTED', 'PROCESSING')`, [payment.id], tx);
      const refundable = payment.amount - payment.refunded_amount - (inFlight?.total ?? 0);
      const amount = req.amount ?? refundable;
      if (!Number.isInteger(amount) || amount <= 0) throw new AppError('VALIDATION_ERROR', 'Refund amount must be a positive whole number.');
      if (amount > refundable) throw new AppError('VALIDATION_ERROR', `Refund amount cannot exceed the refundable balance of ${order.currency} ${refundable.toLocaleString('en-US')}.`, { refundable });
      const row = await queryOne<{ id: string }>(
        `insert into public.refunds (order_id, payment_id, amount, reason, note, status, restock, idempotency_key, requested_by)
         values ($1, $2, $3, $4, $5, 'REQUESTED', $6, $7, $8) returning id`,
        [req.orderId, payment.id, amount, req.reason, req.note ?? null, req.restock, req.idempotencyKey ?? null, req.requestedBy],
        tx,
      );
      return { refundId: row!.id, payment, amount, full: amount === payment.amount - payment.refunded_amount };
    });

    const provider = providerById(prepared.payment.provider);
    const result = await provider.refund({
      providerPaymentId: prepared.payment.provider_payment_id,
      amount: prepared.amount,
      currency: prepared.payment.currency,
      reason: req.reason,
      idempotencyKey: req.idempotencyKey ?? `refund:${prepared.refundId}:${randomToken(6)}`,
    });

    const after: AfterCommit = [];
    await withTransaction(async (tx) => {
      await query(`update public.refunds set status = $2, provider_reference = $3, failure_reason = $4 where id = $1`, [prepared.refundId, result.status, result.providerReference, result.failureReason ?? null], tx);
      if (result.status === 'FAILED') return;
      // PROCESSING counts as refunded for balances; the provider webhook later flips it to COMPLETED.
      const pay = await queryOne<{ amount: number; refunded_amount: number }>(
        `update public.payments set refunded_amount = refunded_amount + $2,
                status = case when refunded_amount + $2 >= amount then 'REFUNDED'::public.payment_status else 'PARTIALLY_REFUNDED'::public.payment_status end
          where id = $1 returning amount, refunded_amount`,
        [prepared.payment.id, prepared.amount],
        tx,
      );
      const fully = pay!.refunded_amount >= pay!.amount;
      await query(`insert into public.payment_status_history (payment_id, status, note) values ($1, $2, $3)`, [prepared.payment.id, fully ? 'REFUNDED' : 'PARTIALLY_REFUNDED', `Refund of ${prepared.amount}`], tx);
      await query(
        `update public.orders set refunded_total = refunded_total + $2, payment_status = $3 where id = $1`,
        [req.orderId, prepared.amount, fully ? 'REFUNDED' : 'PARTIALLY_REFUNDED'],
        tx,
      );
      await query(`insert into public.order_events (order_id, kind, title, description, actor_id, actor_type) values ($1, 'refund', $2, $3, $4, $5)`, [
        req.orderId,
        fully ? 'Full refund issued' : 'Partial refund issued',
        `${prepared.payment.currency} ${prepared.amount.toLocaleString('en-US')}${req.note ? ` — ${req.note}` : ''}`,
        req.requestedBy,
        req.requestedBy ? 'ADMIN' : 'SYSTEM',
      ], tx);

      const order = await lockOrder(tx, req.orderId);
      if (fully) {
        if (req.restock) await restockOrder(tx, req.orderId, 'REFUND', req.requestedBy);
        if (canTransition(order.status, 'REFUNDED')) {
          await transitionOrder(tx, req.orderId, 'REFUNDED', { actorId: req.requestedBy, actorType: req.requestedBy ? 'ADMIN' : 'SYSTEM', system: true, note: req.note ?? 'Refunded' }, after);
        } else if (order.status !== 'CANCELLED' && canTransition(order.status, 'CANCELLED')) {
          await transitionOrder(tx, req.orderId, 'CANCELLED', { actorId: req.requestedBy, actorType: req.requestedBy ? 'ADMIN' : 'SYSTEM', system: true, note: 'Cancelled and refunded', cancelReason: req.note ?? 'Refunded' }, after);
        }
      }
    });
    runAfterCommit(after);
    if (result.status === 'FAILED') throw new AppError('PAYMENT_FAILED', result.failureReason ?? 'The payment provider rejected the refund.', { refundId: prepared.refundId });
    return this.get(prepared.refundId);
  },

  /** Full refund after a paid order was cancelled (customer cancel, or payment arriving after expiry). */
  async refundCancelledOrder(orderId: string, requestedBy: string | null, reason: RefundReason) {
    return this.refund({ orderId, reason, note: 'Order cancelled', restock: false, requestedBy, idempotencyKey: `cancel-refund:${orderId}` });
  },

  async get(refundId: string) {
    const r = await queryOne<Record<string, unknown>>(`select * from public.refunds where id = $1`, [refundId]);
    if (!r) throw notFound('Refund');
    return {
      id: r.id,
      orderId: r.order_id,
      paymentId: r.payment_id,
      amount: r.amount,
      reason: r.reason,
      note: r.note,
      status: r.status,
      providerReference: r.provider_reference,
      restock: r.restock,
      failureReason: r.failure_reason,
      createdAt: new Date(r.created_at as Date).toISOString(),
    };
  },
};
