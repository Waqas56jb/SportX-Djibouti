import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { ok, paginated } from '../../utils/apiResponse.js';
import { notFound } from '../../utils/errors.js';
import { dateBounds, offsetOf, pageMeta, paginationQuery } from '../../utils/pagination.js';
import { query, queryOne, withTransaction } from '../../config/database.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, query as q, uuidParam } from '../../middleware/validation.middleware.js';
import { audit } from '../../services/audit.service.js';
import { MANUAL_STATUSES, runAfterCommit, transitionOrder, type AfterCommit } from './order.state.js';
import { loadOrderDetail, toOrderSummary, type OrderRow } from './orders.mapper.js';
import { paymentsService } from '../payments/payments.service.js';
import { refundsService } from '../payments/refunds.service.js';
import { idempotencyKeyOf } from '../payments/payments.routes.js';
import type { OrderStatus } from '../../types/common.js';

const ORDER_STATUSES = ['PENDING', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUND_REQUESTED', 'REFUNDED'] as const;
const PAYMENT_STATUSES = ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED'] as const;
const SHIPPING_STATUSES = ['PENDING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'] as const;

const listQuery = paginationQuery(100, 20).extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  payment_status: z.enum(PAYMENT_STATUSES).optional(),
  shipping_status: z.enum(SHIPPING_STATUSES).optional(),
  payment_method: z.enum(['CARD', 'MOBILE_MONEY', 'CASH_ON_DELIVERY', 'BANK_TRANSFER']).optional(),
  customer_id: z.string().uuid().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.+\-Z]*)?$/, 'Use YYYY-MM-DD or an ISO date-time.').optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.+\-Z]*)?$/, 'Use YYYY-MM-DD or an ISO date-time.').optional(),
  min_total: z.coerce.number().int().min(0).optional(),
  max_total: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['placed_at', 'grand_total', 'order_number', 'status']).default('placed_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/** Builds the WHERE clause for admin order searches. Values are always bound parameters. */
export function orderFilters(f: z.infer<typeof listQuery>) {
  const where = ['o.deleted_at is null'];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (f.search) {
    params.push(`%${f.search}%`);
    const i = params.length;
    where.push(`(o.order_number ilike $${i} or o.email ilike $${i} or o.phone ilike $${i} or (o.customer_first_name || ' ' || o.customer_last_name) ilike $${i})`);
  }
  // "SHIPPED" tab includes orders out for delivery.
  if (f.status === 'SHIPPED') where.push(`o.status in ('SHIPPED', 'OUT_FOR_DELIVERY')`);
  else if (f.status) add('o.status = ?', f.status);
  if (f.payment_status) add('o.payment_status = ?', f.payment_status);
  if (f.shipping_status) add('o.shipping_status = ?', f.shipping_status);
  if (f.payment_method) add('o.payment_method = ?', f.payment_method);
  if (f.customer_id) add('o.user_id = ?', f.customer_id);
  const { from, to } = dateBounds(f.date_from, f.date_to);
  if (from) add('o.placed_at >= ?', from);
  if (to) add('o.placed_at <= ?', to);
  if (f.min_total !== undefined) add('o.grand_total >= ?', f.min_total);
  if (f.max_total !== undefined) add('o.grand_total <= ?', f.max_total);
  return { where: where.join(' and '), params };
}

/** /api/v1/admin/orders — requireAdmin is applied by the parent router. */
export const adminOrdersRouter = Router();

adminOrdersRouter.get(
  '/',
  requirePermission('orders:view'),
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const f = q<z.infer<typeof listQuery>>(req);
    const { where, params } = orderFilters(f);
    const n = params.length;
    const [rows, total] = await Promise.all([
      query<OrderRow & { first_item_image: string | null }>(
        `select o.*, (select image_url from public.order_items i where i.order_id = o.id order by (i.image_url is null), i.created_at limit 1) as first_item_image
           from public.orders o where ${where} order by o.${f.sort} ${f.order}, o.id limit $${n + 1} offset $${n + 2}`,
        [...params, f.limit, offsetOf(f.page, f.limit)],
      ),
      queryOne<{ n: number }>(`select count(*)::int as n from public.orders o where ${where}`, params),
    ]);
    return paginated(res, rows.map(toOrderSummary), pageMeta(f.page, f.limit, total?.n ?? 0));
  }),
);

adminOrdersRouter.get(
  '/counts',
  requirePermission('orders:view'),
  asyncHandler(async (_req, res) => {
    const rows = await query<{ status: OrderStatus; n: number }>(`select status, count(*)::int as n from public.orders where deleted_at is null group by status`);
    const counts: Record<string, number> = { ALL: 0 };
    for (const s of ORDER_STATUSES) counts[s] = 0;
    for (const r of rows) {
      counts[r.status] = r.n;
      counts.ALL += r.n;
    }
    const refundRequests = await queryOne<{ n: number }>(`select count(*)::int as n from public.orders where status = 'REFUND_REQUESTED' and deleted_at is null`);
    return ok(res, { ...counts, NEEDS_ACTION: counts.PENDING + counts.PAYMENT_CONFIRMED + counts.PROCESSING, REFUND_REQUESTS: refundRequests?.n ?? 0 });
  }),
);

adminOrdersRouter.get(
  '/:id',
  requirePermission('orders:view'),
  asyncHandler(async (req, res) => {
    const row = await queryOne<{ id: string }>(`select id from public.orders where (id::text = $1 or order_number = $1) and deleted_at is null`, [req.params.id]);
    if (!row) throw notFound('Order');
    return ok(res, await loadOrderDetail(row.id, 'admin'));
  }),
);

adminOrdersRouter.patch(
  '/:id/status',
  requirePermission('orders:edit'),
  validate({ params: uuidParam(), body: z.object({ status: z.enum(MANUAL_STATUSES as [OrderStatus, ...OrderStatus[]]), note: z.string().trim().max(500).optional().nullable() }) }),
  asyncHandler(async (req, res) => {
    const after: AfterCommit = [];
    await withTransaction(async (tx) => {
      const before = await queryOne<{ status: string; order_number: string }>(`select status, order_number from public.orders where id = $1`, [req.params.id], tx);
      if (!before) throw notFound('Order');
      await transitionOrder(tx, req.params.id, req.body.status, { actorId: req.auth!.userId, actorType: 'ADMIN', note: req.body.note, cancelReason: req.body.note }, after);
      await audit(req, { action: 'Order status changed', entityType: 'order', entityId: req.params.id, metadata: { orderNumber: before.order_number, from: before.status, to: req.body.status } }, tx);
    });
    runAfterCommit(after);
    return ok(res, await loadOrderDetail(req.params.id, 'admin'), 'Order status updated.');
  }),
);

adminOrdersRouter.patch(
  '/:id/payment-status',
  requirePermission('orders:approve'),
  validate({ params: uuidParam(), body: z.object({ status: z.enum(['PAID', 'FAILED']), note: z.string().trim().max(500).optional().nullable() }) }),
  asyncHandler(async (req, res) => {
    await paymentsService.setOfflinePaymentStatus(req.params.id, req.body.status, req.auth!.userId, req.body.note);
    await audit(req, { action: `Payment marked ${req.body.status.toLowerCase()}`, entityType: 'order', entityId: req.params.id, metadata: { note: req.body.note } });
    return ok(res, await loadOrderDetail(req.params.id, 'admin'), 'Payment status updated.');
  }),
);

adminOrdersRouter.post(
  '/:id/cancel',
  requirePermission('orders:edit'),
  validate({ params: uuidParam(), body: z.object({ reason: z.string().trim().min(2).max(300), refund: z.boolean().default(true) }) }),
  asyncHandler(async (req, res) => {
    const after: AfterCommit = [];
    const paid = await withTransaction(async (tx) => {
      const o = await queryOne<{ payment_status: string; order_number: string }>(`select payment_status, order_number from public.orders where id = $1`, [req.params.id], tx);
      if (!o) throw notFound('Order');
      await transitionOrder(tx, req.params.id, 'CANCELLED', { actorId: req.auth!.userId, actorType: 'ADMIN', note: req.body.reason, cancelReason: req.body.reason }, after);
      await audit(req, { action: 'Order cancelled', entityType: 'order', entityId: req.params.id, metadata: { orderNumber: o.order_number, reason: req.body.reason } }, tx);
      return ['PAID', 'PARTIALLY_REFUNDED'].includes(o.payment_status);
    });
    runAfterCommit(after);
    if (paid && req.body.refund) await refundsService.refund({ orderId: req.params.id, reason: 'OTHER', note: req.body.reason, restock: false, requestedBy: req.auth!.userId, idempotencyKey: `cancel-refund:${req.params.id}` });
    return ok(res, await loadOrderDetail(req.params.id, 'admin'), 'Order cancelled.');
  }),
);

adminOrdersRouter.post(
  '/:id/refund',
  requirePermission('orders:approve'),
  validate({
    params: uuidParam(),
    body: z.object({
      type: z.enum(['full', 'partial']).default('full'),
      amount: z.number().int().positive().optional(),
      reason: z.enum(['CUSTOMER_REQUEST', 'DAMAGED_ITEM', 'WRONG_ITEM', 'PAYMENT_ISSUE', 'OTHER']),
      note: z.string().trim().max(500).optional().nullable(),
      restock: z.boolean().default(false),
    }).refine((b) => b.type === 'full' || b.amount !== undefined, { message: 'Amount is required for a partial refund.', path: ['amount'] }),
  }),
  asyncHandler(async (req, res) => {
    const key = idempotencyKeyOf(req.header('idempotency-key'));
    const refund = await refundsService.refund({
      orderId: req.params.id,
      amount: req.body.type === 'partial' ? req.body.amount : undefined,
      reason: req.body.reason,
      note: req.body.note,
      restock: req.body.restock,
      requestedBy: req.auth!.userId,
      idempotencyKey: key ? `admin-refund:${req.params.id}:${key}` : null,
    });
    await audit(req, { action: 'Refund issued', entityType: 'order', entityId: req.params.id, metadata: { amount: refund.amount, status: refund.status, reason: refund.reason } });
    return ok(res, { refund, order: await loadOrderDetail(req.params.id, 'admin') }, refund.status === 'COMPLETED' ? 'Refund completed.' : 'Refund is processing.');
  }),
);

adminOrdersRouter.patch(
  '/:id/shipping',
  requirePermission('orders:edit'),
  validate({
    params: uuidParam(),
    body: z.object({
      carrier: z.string().trim().max(80).optional(),
      trackingNumber: z.string().trim().max(80).optional(),
      estimatedDeliveryAt: z.string().datetime({ offset: true }).optional().nullable(),
    }),
  }),
  asyncHandler(async (req, res) => {
    await withTransaction(async (tx) => {
      const s = await queryOne<{ tracking_number: string | null }>(`select tracking_number from public.shipping where order_id = $1 for update`, [req.params.id], tx);
      if (!s) throw notFound('Order');
      await query(
        `update public.shipping set carrier = coalesce($2, carrier), tracking_number = coalesce($3, tracking_number),
                estimated_delivery_at = case when $5 then $4::timestamptz else estimated_delivery_at end where order_id = $1`,
        [req.params.id, req.body.carrier ?? null, req.body.trackingNumber ?? null, req.body.estimatedDeliveryAt ?? null, req.body.estimatedDeliveryAt !== undefined],
        tx,
      );
      if (req.body.trackingNumber && req.body.trackingNumber !== s.tracking_number) {
        await query(`insert into public.order_events (order_id, kind, title, description, actor_id, actor_type) values ($1, 'tracking', 'Tracking number added', $2, $3, 'ADMIN')`, [
          req.params.id,
          `${req.body.carrier ?? ''} ${req.body.trackingNumber}`.trim(),
          req.auth!.userId,
        ], tx);
      }
      await audit(req, { action: 'Shipping details updated', entityType: 'order', entityId: req.params.id, metadata: req.body }, tx);
    });
    return ok(res, await loadOrderDetail(req.params.id, 'admin'), 'Shipping updated.');
  }),
);

adminOrdersRouter.post(
  '/:id/notes',
  requirePermission('orders:edit'),
  validate({ params: uuidParam(), body: z.object({ note: z.string().trim().min(1).max(1000) }) }),
  asyncHandler(async (req, res) => {
    const r = await queryOne<{ id: string }>(
      `insert into public.order_events (order_id, kind, title, description, actor_id, actor_type)
       select id, 'note', 'Internal note', $2, $3, 'ADMIN' from public.orders where id = $1 returning id`,
      [req.params.id, req.body.note, req.auth!.userId],
    );
    if (!r) throw notFound('Order');
    return ok(res, await loadOrderDetail(req.params.id, 'admin'), 'Note added.');
  }),
);

