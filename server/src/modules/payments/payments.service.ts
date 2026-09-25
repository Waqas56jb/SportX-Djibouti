import { query, queryOne, withTransaction } from '../../config/database.js';
import { AppError, notFound } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { randomToken } from '../../utils/http.js';
import { notificationService } from '../../services/notification/notification.service.js';
import { providerById, providerForMethod } from '../../services/payment/payment.registry.js';
import type { NormalizedWebhookEvent, PaymentProvider } from '../../services/payment/payment.provider.js';
import { lockOrder, runAfterCommit, transitionOrder, type AfterCommit } from '../orders/order.state.js';
import type { PaymentMethod, PaymentStatus } from '../../types/common.js';

export interface PaymentRow {
  id: string;
  order_id: string;
  provider: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  refunded_amount: number;
  currency: string;
  provider_payment_id: string | null;
  idempotency_key: string | null;
  failure_reason: string | null;
  card_brand: string | null;
  card_last4: string | null;
  paid_at: Date | null;
  created_at: Date;
}

export function toPublicPayment(p: PaymentRow) {
  return {
    id: p.id,
    orderId: p.order_id,
    provider: p.provider,
    method: p.method,
    status: p.status,
    amount: p.amount,
    refundedAmount: p.refunded_amount,
    currency: p.currency,
    cardBrand: p.card_brand,
    cardLast4: p.card_last4,
    failureReason: p.failure_reason,
    paidAt: p.paid_at ? new Date(p.paid_at).toISOString() : null,
    createdAt: new Date(p.created_at).toISOString(),
  };
}

async function setPaymentStatus(tx: Parameters<typeof query>[2], paymentId: string, status: PaymentStatus, note: string, extra: Record<string, unknown> = {}) {
  const sets = ['status = $2', ...Object.keys(extra).map((k, i) => `${k} = $${i + 3}`)];
  await query(`update public.payments set ${sets.join(', ')} where id = $1`, [paymentId, status, ...Object.values(extra)], tx);
  await query(`insert into public.payment_status_history (payment_id, status, note) values ($1, $2, $3)`, [paymentId, status, note], tx);
}

export const paymentsService = {
  /**
   * Starts (or resumes) an online payment for the customer's unpaid order. Reuses the open payment
   * for the same Idempotency-Key so double clicks never create duplicate charges.
   */
  async createForOrder(userId: string, orderId: string, idempotencyKey: string | null) {
    const order = await queryOne<{ id: string; order_number: string; user_id: string; status: string; payment_status: string; payment_method: PaymentMethod; grand_total: number; currency: string; email: string }>(
      `select id, order_number, user_id, status, payment_status, payment_method, grand_total, currency, email from public.orders where id = $1 and deleted_at is null`,
      [orderId],
    );
    if (!order || order.user_id !== userId) throw notFound('Order');
    if (order.payment_status === 'PAID') throw new AppError('CONFLICT', 'This order is already paid.');
    if (order.status !== 'PAYMENT_PENDING') throw new AppError('ORDER_INVALID', order.status === 'CANCELLED' ? 'This order was cancelled.' : 'This order does not need an online payment.');

    const provider = providerForMethod(order.payment_method);
    // Scoped to the order; also forwarded to the provider so its API de-duplicates retries.
    const key = idempotencyKey ? `${orderId}:${idempotencyKey}` : null;

    // A new attempt after a decline: the order is awaiting payment again.
    await query(`update public.orders set payment_status = 'PENDING' where id = $1 and payment_status = 'FAILED'`, [orderId]);

    // Reuse the open (not yet started) payment row created with the order, otherwise add a new attempt.
    const open = await queryOne<PaymentRow>(
      `select * from public.payments where order_id = $1 and status = 'PENDING' and provider_payment_id is null order by created_at desc limit 1`,
      [orderId],
    );
    const paymentId =
      open?.id ??
      (await queryOne<{ id: string }>(`insert into public.payments (order_id, provider, method, status, amount, currency) values ($1, $2, $3, 'PENDING', $4, $5) returning id`, [
        orderId,
        provider.id,
        order.payment_method,
        order.grand_total,
        order.currency,
      ]))!.id;

    const result = await provider.createPayment({
      paymentId,
      orderId,
      orderNumber: order.order_number,
      amount: order.grand_total,
      currency: order.currency,
      method: order.payment_method,
      customerEmail: order.email,
      idempotencyKey: key ?? `${paymentId}:${randomToken(8)}`,
    });
    const row = await queryOne<PaymentRow>(
      `update public.payments set provider = $2, provider_payment_id = $3, status = $4, idempotency_key = coalesce(idempotency_key, (select $5::text where not exists (select 1 from public.payments where idempotency_key = $5))), metadata = metadata || $6::jsonb
        where id = $1 returning *`,
      [paymentId, provider.id, result.providerPaymentId, result.status, key, JSON.stringify(result.metadata ?? {})],
    );
    return { payment: toPublicPayment(row!), clientSecret: result.clientSecret ?? null, redirectUrl: result.redirectUrl ?? null, provider: provider.id };
  },

  async getForCustomer(userId: string, paymentId: string) {
    const p = await queryOne<PaymentRow & { user_id: string }>(
      `select p.*, o.user_id from public.payments p join public.orders o on o.id = p.order_id where p.id = $1`,
      [paymentId],
    );
    if (!p || p.user_id !== userId) throw notFound('Payment');
    return toPublicPayment(p);
  },

  /**
   * Verified webhook → idempotent state change. The (provider, event_id) unique key means repeated
   * deliveries are recorded once and processed once.
   */
  async handleWebhook(provider: PaymentProvider, event: NormalizedWebhookEvent): Promise<'processed' | 'duplicate' | 'ignored'> {
    const rec = await queryOne<{ id: string; processed_at: Date | null }>(
      `insert into public.payment_events (provider, event_id, type, payload) values ($1, $2, $3, $4)
       on conflict (provider, event_id) do update set type = excluded.type
       returning id, processed_at`,
      [provider.id, event.eventId, event.type, JSON.stringify(event.raw ?? {})],
    );
    if (rec!.processed_at) return 'duplicate';
    if (event.type === 'ignored') {
      await query(`update public.payment_events set processed_at = now() where id = $1`, [rec!.id]);
      return 'ignored';
    }
    try {
      await this.applyEvent(provider, event, rec!.id);
      return 'processed';
    } catch (err) {
      await query(`update public.payment_events set error = $2 where id = $1`, [rec!.id, (err as Error).message.slice(0, 500)]);
      throw err;
    }
  },

  async applyEvent(provider: PaymentProvider, event: NormalizedWebhookEvent, eventRowId: string) {
    const after: AfterCommit = [];
    let refundCancelled: string | null = null;
    await withTransaction(async (tx) => {
      const payment = await queryOne<PaymentRow>(
        `select * from public.payments where provider = $1 and (provider_payment_id = $2 or ($3::uuid is not null and id = $3::uuid)) for update`,
        [provider.id, event.providerPaymentId ?? null, event.paymentId ?? null],
        tx,
      );
      if (!payment) {
        logger.warn({ provider: provider.id, eventId: event.eventId }, 'webhook for unknown payment');
        await query(`update public.payment_events set processed_at = now(), error = 'unknown payment' where id = $1`, [eventRowId], tx);
        return;
      }
      await query(`update public.payment_events set payment_id = $2 where id = $1`, [eventRowId, payment.id], tx);
      const order = await lockOrder(tx, payment.order_id);

      if (event.type === 'payment.succeeded') {
        if (payment.status === 'PAID' || payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED') {
          // Already settled — never charge or confirm twice.
        } else {
          if (event.amount !== undefined && event.amount !== payment.amount) {
            logger.error({ paymentId: payment.id, expected: payment.amount, got: event.amount }, 'payment amount mismatch');
            await setPaymentStatus(tx, payment.id, 'FAILED', 'Amount mismatch', { failure_reason: 'Amount mismatch — manual review required' });
            await notificationService.toStaff({ type: 'PAYMENT_FAILED', title: `Payment amount mismatch on ${order.order_number}`, message: 'Review this payment manually.', link: `/orders/${order.id}` }, tx);
          } else {
            await setPaymentStatus(tx, payment.id, 'PAID', 'Confirmed by provider webhook', {
              paid_at: new Date().toISOString(),
              card_brand: event.card?.brand ?? null,
              card_last4: event.card?.last4 && /^\d{4}$/.test(event.card.last4) ? event.card.last4 : null,
              failure_reason: null,
            });
            await query(`update public.orders set payment_status = 'PAID' where id = $1`, [order.id], tx);
            if (order.status === 'PAYMENT_PENDING' || order.status === 'PENDING') {
              await transitionOrder(tx, order.id, 'PAYMENT_CONFIRMED', { actorType: 'SYSTEM', system: true, note: 'Payment confirmed' }, after);
            } else if (order.status === 'CANCELLED') {
              // Paid after the order expired: stock was released, so give the money back.
              refundCancelled = order.id;
              await notificationService.toStaff({ type: 'PAYMENT_FAILED', title: `Payment received for cancelled order ${order.order_number}`, message: 'An automatic refund was started.', link: `/orders/${order.id}` }, tx);
            }
          }
        }
      } else if (event.type === 'payment.authorized') {
        if (payment.status === 'PENDING') await setPaymentStatus(tx, payment.id, 'AUTHORIZED', 'Authorised by provider');
      } else if (event.type === 'payment.failed' || event.type === 'payment.cancelled') {
        if (payment.status === 'PENDING' || payment.status === 'AUTHORIZED') {
          await setPaymentStatus(tx, payment.id, event.type === 'payment.failed' ? 'FAILED' : 'CANCELLED', event.failureReason ?? 'Payment failed', { failure_reason: event.failureReason ?? 'Payment failed' });
          // Order stays PAYMENT_PENDING so the customer can retry until the payment window closes.
          await query(`update public.orders set payment_status = 'FAILED' where id = $1 and payment_status in ('PENDING', 'AUTHORIZED')`, [order.id], tx);
          await notificationService.toStaff({ type: 'PAYMENT_FAILED', title: `Payment failed on ${order.order_number}`, message: event.failureReason ?? 'The payment was declined.', link: `/orders/${order.id}` }, tx);
        }
      } else if (event.type === 'refund.succeeded') {
        await query(`update public.refunds set status = 'COMPLETED' where payment_id = $1 and status = 'PROCESSING'`, [payment.id], tx);
      }
      await query(`update public.payment_events set processed_at = now() where id = $1`, [eventRowId], tx);
    });
    runAfterCommit(after);
    if (refundCancelled) {
      const { refundsService } = await import('./refunds.service.js');
      await refundsService.refundCancelledOrder(refundCancelled, null, 'PAYMENT_ISSUE').catch((err) => logger.error({ err }, 'auto refund failed'));
    }
  },

  /**
   * Staff confirmation of an OFFLINE payment (cash on delivery, bank transfer). Card and mobile-money
   * payments can only be confirmed by a verified provider webhook — never by an API call.
   */
  async setOfflinePaymentStatus(orderId: string, status: 'PAID' | 'FAILED', adminId: string, note?: string | null) {
    const after: AfterCommit = [];
    await withTransaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      if (!['CASH_ON_DELIVERY', 'BANK_TRANSFER'].includes(order.payment_method)) {
        throw new AppError('FORBIDDEN', 'Online payments are confirmed only by the payment provider.');
      }
      const payment = await queryOne<PaymentRow>(`select * from public.payments where order_id = $1 order by created_at desc limit 1 for update`, [orderId], tx);
      if (!payment) throw notFound('Payment');
      if (payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED') throw new AppError('CONFLICT', 'Refunded payments cannot be changed.');
      if (payment.status === status) return;
      if (status === 'PAID') {
        await setPaymentStatus(tx, payment.id, 'PAID', note ?? 'Confirmed by staff', { paid_at: new Date().toISOString() });
        await query(`update public.orders set payment_status = 'PAID' where id = $1`, [orderId], tx);
        if (order.status === 'PENDING') await transitionOrder(tx, orderId, 'PAYMENT_CONFIRMED', { actorId: adminId, actorType: 'ADMIN', system: true, note: note ?? 'Payment received' }, after);
      } else {
        await setPaymentStatus(tx, payment.id, 'FAILED', note ?? 'Marked failed by staff', { failure_reason: note ?? 'Payment not received' });
        await query(`update public.orders set payment_status = 'FAILED' where id = $1`, [orderId], tx);
      }
      await query(`insert into public.order_events (order_id, kind, title, description, actor_id, actor_type) values ($1, 'payment', $2, $3, $4, 'ADMIN')`, [
        orderId,
        status === 'PAID' ? 'Payment marked as received' : 'Payment marked as failed',
        note ?? null,
        adminId,
      ], tx);
    });
    runAfterCommit(after);
  },

  providerById,
};

