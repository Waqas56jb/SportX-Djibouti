import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { created, ok, paginated } from '../../utils/apiResponse.js';
import { AppError, notFound } from '../../utils/errors.js';
import { offsetOf, pageMeta } from '../../utils/pagination.js';
import { pool, query, queryOne } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate, query as q, uuidParam } from '../../middleware/validation.middleware.js';
import { writeLimiter } from '../../middleware/rateLimit.middleware.js';
import { priceCart } from '../pricing/pricing.service.js';
import { shippingService } from '../shipping/shipping.service.js';
import { availablePaymentMethods } from '../../services/payment/payment.registry.js';
import { ordersService } from './orders.service.js';
import { loadOrderDetail, toOrderSummary, type OrderRow } from './orders.mapper.js';
import { cancelSchema, checkoutValidateSchema, createOrderSchema, listOrdersQuery } from './orders.schema.js';
import { idempotencyKeyOf } from '../payments/payments.routes.js';
import { z } from 'zod';

/** /api/v1/orders — the signed-in customer's own orders only. */
export const ordersRouter = Router();
ordersRouter.use(authenticate);

ordersRouter.post(
  '/',
  writeLimiter,
  validate({ body: createOrderSchema }),
  asyncHandler(async (req, res) => {
    const { orderId, replayed } = await ordersService.createOrder(req.auth!.userId, req.body, idempotencyKeyOf(req.header('idempotency-key')));
    const order = await loadOrderDetail(orderId, 'customer');
    return replayed ? ok(res, order, 'Order already placed.') : created(res, order, 'Order placed.');
  }),
);

ordersRouter.get(
  '/',
  validate({ query: listOrdersQuery }),
  asyncHandler(async (req, res) => {
    const { page, limit, status } = q<z.infer<typeof listOrdersQuery>>(req);
    const filter =
      status === 'active'
        ? `and status not in ('DELIVERED', 'CANCELLED', 'REFUNDED')`
        : status === 'delivered'
          ? `and status = 'DELIVERED'`
          : status === 'cancelled'
            ? `and status in ('CANCELLED', 'REFUNDED')`
            : '';
    const [rows, total] = await Promise.all([
      query<OrderRow & { first_item_image: string | null }>(
        `select o.*, (select image_url from public.order_items i where i.order_id = o.id order by (i.image_url is null), i.created_at limit 1) as first_item_image
           from public.orders o where o.user_id = $1 and o.deleted_at is null ${filter}
          order by o.placed_at desc limit $2 offset $3`,
        [req.auth!.userId, limit, offsetOf(page, limit)],
      ),
      queryOne<{ n: number }>(`select count(*)::int as n from public.orders where user_id = $1 and deleted_at is null ${filter}`, [req.auth!.userId]),
    ]);
    return paginated(res, rows.map(toOrderSummary), pageMeta(page, limit, total?.n ?? 0));
  }),
);

ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => ok(res, await ordersService.getForCustomer(req.auth!.userId, req.params.id))),
);

ordersRouter.post(
  '/:id/cancel',
  validate({ params: uuidParam(), body: cancelSchema }),
  asyncHandler(async (req, res) => ok(res, await ordersService.cancelByCustomer(req.auth!.userId, req.params.id, req.body.reason), 'Order cancelled.')),
);

/** /api/v1/checkout */
export const checkoutRouter = Router();
checkoutRouter.use(authenticate);

/**
 * Server-driven checkout validation: prices the customer's server cart, checks stock, coupon,
 * shipping method and address, and returns the authoritative breakdown plus every problem found.
 */
checkoutRouter.post(
  '/validate',
  validate({ body: checkoutValidateSchema }),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const lines = await ordersService.cartLines(pool, userId);
    const problems: { field: string; message: string }[] = [];
    let city = req.body.address?.city as string | undefined;
    if (req.body.addressId) {
      const a = await queryOne<{ city: string }>(`select city from public.addresses where id = $1 and user_id = $2`, [req.body.addressId, userId]);
      if (!a) throw notFound('Address');
      city = a.city;
    }
    let method = null;
    if (req.body.shippingMethod) {
      try {
        method = await shippingService.requireMethod(req.body.shippingMethod);
      } catch (e) {
        if (e instanceof AppError) problems.push({ field: 'shippingMethod', message: e.message });
        else throw e;
      }
      if (method?.requiresAddress && !req.body.addressId && !(req.body.address?.addressLine1 && req.body.address?.city)) problems.push({ field: 'address', message: 'A delivery address is required for this shipping method.' });
    }
    if (req.body.paymentMethod && !availablePaymentMethods().some((m) => m.method === req.body.paymentMethod)) problems.push({ field: 'paymentMethod', message: 'This payment method is not available.' });
    const couponCode = req.body.couponCode === undefined ? lines[0]?.couponCode ?? null : req.body.couponCode;
    const breakdown = await priceCart(lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), { couponCode, shippingMethod: method?.code, userId, city });
    if (!lines.length) problems.push({ field: 'cart', message: 'Your bag is empty.' });
    const shippingOptions = await shippingService.quoteAll(Math.max(0, breakdown.totals.merchandiseTotal - breakdown.totals.couponDiscount), city);
    const valid = problems.length === 0 && breakdown.issues.filter((i) => i.type !== 'PRICE_CHANGED').length === 0 && (!breakdown.coupon || breakdown.coupon.valid) && Boolean(method);
    return ok(res, { valid, problems, ...breakdown, shippingOptions, paymentMethods: availablePaymentMethods() });
  }),
);
