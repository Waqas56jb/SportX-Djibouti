import type { PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { pool, query, queryOne, withTransaction } from '../../config/database.js';
import { AppError, forbidden, notFound } from '../../utils/errors.js';
import { nextOrderNumber } from '../../utils/orderNumber.js';
import { emailService } from '../../services/email/email.service.js';
import { notificationService } from '../../services/notification/notification.service.js';
import { providerForMethod } from '../../services/payment/payment.registry.js';
import { assertPurchasable, priceCart } from '../pricing/pricing.service.js';
import { reserveStock } from '../inventory/inventory.core.js';
import { shippingService } from '../shipping/shipping.service.js';
import { getStoreSettings } from '../settings/settings.service.js';
import { CUSTOMER_CANCELLABLE, lockOrder, runAfterCommit, transitionOrder, type AfterCommit } from './order.state.js';
import { loadOrderDetail } from './orders.mapper.js';
import type { PaymentMethod } from '../../types/common.js';

export interface AddressInput {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  district?: string | null;
  city: string;
  country?: string;
  postalCode?: string | null;
}

export interface CreateOrderInput {
  addressId?: string;
  address?: AddressInput;
  shippingMethod: string;
  paymentMethod: PaymentMethod;
  couponCode?: string | null;
  customerNote?: string | null;
}

async function cartLines(db: PoolClient | typeof pool, userId: string) {
  return query<{ variantId: string; quantity: number; productId: string; couponCode: string | null }>(
    `select ci.variant_id as "variantId", ci.quantity, ci.product_id as "productId", c.coupon_code as "couponCode"
       from public.carts c join public.cart_items ci on ci.cart_id = c.id
      where c.user_id = $1 order by ci.created_at`,
    [userId],
    db,
  );
}

async function resolveAddress(db: PoolClient, userId: string, input: CreateOrderInput): Promise<Record<string, unknown> | null> {
  if (input.addressId) {
    const a = await queryOne<Record<string, string | null>>(`select * from public.addresses where id = $1 and user_id = $2`, [input.addressId, userId], db);
    if (!a) throw notFound('Address');
    return {
      firstName: a.first_name,
      lastName: a.last_name,
      phone: a.phone,
      addressLine1: a.address_line_1,
      addressLine2: a.address_line_2,
      district: a.district,
      city: a.city,
      country: a.country,
      postalCode: a.postal_code,
    };
  }
  if (input.address) return { country: 'Djibouti', ...input.address };
  return null;
}

export const ordersService = {
  cartLines,

  /**
   * Controlled checkout workflow — one transaction:
   * load cart → price on the server (locks stock + coupon) → reserve inventory → order, items, history,
   * shipping, payment records → coupon usage → clear cart. Emails run only after COMMIT.
   * Replaying the same Idempotency-Key returns the original order instead of creating another.
   */
  async createOrder(userId: string, input: CreateOrderInput, idempotencyKey: string | null): Promise<{ orderId: string; replayed: boolean }> {
    if (idempotencyKey) {
      const existing = await queryOne<{ id: string }>(`select id from public.orders where user_id = $1 and idempotency_key = $2`, [userId, idempotencyKey]);
      if (existing) return { orderId: existing.id, replayed: true };
    }
    const provider = providerForMethod(input.paymentMethod);
    const after: AfterCommit = [];

    try {
      const orderId = await withTransaction(async (tx) => {
        const user = await queryOne<{ first_name: string; last_name: string; email: string; phone: string | null; status: string }>(
          `select first_name, last_name, email, phone, status from public.users where id = $1 for update`,
          [userId],
          tx,
        );
        if (!user || user.status !== 'ACTIVE') throw forbidden('This account cannot place orders.');

        const lines = await cartLines(tx, userId);
        if (!lines.length) throw new AppError('ORDER_INVALID', 'Your bag is empty.');

        const method = await shippingService.requireMethod(input.shippingMethod, tx);
        const address = await resolveAddress(tx, userId, input);
        if (method.requiresAddress && !address) throw new AppError('VALIDATION_ERROR', 'A delivery address is required for this shipping method.');

        const couponCode = input.couponCode === undefined ? lines[0].couponCode : input.couponCode;
        const price = await priceCart(lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), { couponCode, shippingMethod: method.code, userId, city: address?.city as string | undefined, lock: true }, tx);
        assertPurchasable(price);

        await reserveStock(tx, price.lines.map((l) => ({ variantId: l.variantId, productId: l.productId, quantity: l.quantity })));

        const settings = await getStoreSettings(tx);
        const orderNumber = await nextOrderNumber(tx, settings.orderPrefix);
        const offline = input.paymentMethod === 'CASH_ON_DELIVERY' || input.paymentMethod === 'BANK_TRANSFER';
        const free = price.totals.grandTotal === 0;
        const status = free || offline ? 'PENDING' : 'PAYMENT_PENDING';
        const expiresAt = status === 'PAYMENT_PENDING' ? new Date(Date.now() + settings.pendingPaymentTtlMinutes * 60_000).toISOString() : null;
        const phone = (address?.phone as string | undefined) ?? user.phone ?? '';

        const order = await queryOne<{ id: string }>(
          `insert into public.orders (order_number, user_id, email, phone, customer_first_name, customer_last_name, status, payment_status,
             payment_method, currency, subtotal, product_discount_total, coupon_code, coupon_discount, shipping_total, tax_total, grand_total,
             items_count, shipping_method_id, shipping_method_code, shipping_method_name, shipping_address, customer_note, idempotency_key, payment_expires_at)
           values ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) returning id`,
          [
            orderNumber, userId, user.email, phone, (address?.firstName as string) || user.first_name, (address?.lastName as string) || user.last_name,
            status, input.paymentMethod, price.currency, price.totals.subtotal, price.totals.productDiscount,
            price.coupon?.valid ? price.coupon.code : null, price.totals.couponDiscount, price.totals.shipping,
            price.totals.taxInclusive ? 0 : price.totals.tax, price.totals.grandTotal, price.totals.itemCount,
            method.id, method.code, method.name, address ? JSON.stringify(address) : null, input.customerNote ?? null, idempotencyKey, expiresAt,
          ],
          tx,
        );
        const id = order!.id;

        for (const l of price.lines) {
          await query(
            `insert into public.order_items (order_id, product_id, variant_id, product_name, product_slug, brand_name, sku, color, size, image_url,
               original_unit_price, unit_price, quantity, discount_total, line_total)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [id, l.productId, l.variantId, l.productName, l.productSlug, l.brandName, l.sku, l.color, l.size, l.imageUrl, l.originalUnitPrice, l.unitPrice, l.quantity, l.lineDiscount, l.lineTotal],
            tx,
          );
        }
        await query(`insert into public.order_status_history (order_id, status, note, changed_by, actor_type) values ($1, $2, 'Order placed', $3, 'CUSTOMER')`, [id, status, userId], tx);
        await query(
          `insert into public.shipping (order_id, method_code, carrier, cost, estimated_delivery_at) values ($1, $2, $3, $4, $5)`,
          [id, method.code, method.carrier, price.totals.shipping, price.shipping?.estimatedDelivery.latest ?? null],
          tx,
        );
        const payment = await queryOne<{ id: string }>(
          `insert into public.payments (order_id, provider, method, status, amount, currency) values ($1, $2, $3, 'PENDING', $4, $5) returning id`,
          [id, provider.id, input.paymentMethod, price.totals.grandTotal, price.currency],
          tx,
        );
        await query(`insert into public.payment_status_history (payment_id, status, note) values ($1, 'PENDING', 'Payment record created')`, [payment!.id], tx);

        if (price.coupon?.valid) {
          const used = await queryOne<{ id: string }>(
            `update public.coupons set usage_count = usage_count + 1 where code = $1 and deleted_at is null and (usage_limit is null or usage_count < usage_limit) returning id`,
            [price.coupon.code],
            tx,
          );
          if (!used) throw new AppError('INVALID_COUPON', 'This code has reached its usage limit.');
          await query(`insert into public.coupon_usages (coupon_id, user_id, order_id, discount_amount) values ($1, $2, $3, $4)`, [used.id, userId, id, price.totals.couponDiscount], tx);
        }

        await query(`delete from public.cart_items where cart_id = (select id from public.carts where user_id = $1)`, [userId], tx);
        await query(`update public.carts set coupon_code = null where user_id = $1`, [userId], tx);

        if (free) {
          await query(`update public.payments set status = 'PAID', paid_at = now() where id = $1`, [payment!.id], tx);
          await query(`update public.orders set payment_status = 'PAID' where id = $1`, [id], tx);
          await transitionOrder(tx, id, 'PAYMENT_CONFIRMED', { actorType: 'SYSTEM', system: true, note: 'Nothing to pay' }, after);
        }

        await notificationService.toUser(userId, { type: 'ORDER_CREATED', title: 'Order received', message: `Order ${orderNumber} was placed.`, link: `/account/orders/${id}`, data: { orderId: id } }, tx);
        await notificationService.toStaff({ type: 'NEW_ORDER', title: `New order ${orderNumber}`, message: `${user.first_name} ${user.last_name} placed an order for ${price.totals.itemCount} item(s).`, link: `/orders/${id}`, data: { orderId: id } }, tx);
        after.push(() =>
          emailService.queue('order_confirmation', user.email, {
            firstName: user.first_name,
            orderNumber,
            total: `${price.currency} ${price.totals.grandTotal.toLocaleString('en-US')}`,
            link: `${env.FRONTEND_URL}/account/orders/${id}`,
          }),
        );
        return id;
      });
      runAfterCommit(after);
      return { orderId, replayed: false };
    } catch (err) {
      // Concurrent double-submit with the same key: the unique index rejected the second insert.
      if (idempotencyKey && (err as { code?: string }).code === '23505') {
        const existing = await queryOne<{ id: string }>(`select id from public.orders where user_id = $1 and idempotency_key = $2`, [userId, idempotencyKey]);
        if (existing) return { orderId: existing.id, replayed: true };
      }
      throw err;
    }
  },

  /** Owner-checked read: an order id belonging to someone else is reported as not found. */
  async getForCustomer(userId: string, idOrNumber: string) {
    const row = await queryOne<{ id: string }>(
      `select id from public.orders where (id::text = $1 or order_number = $1) and user_id = $2 and deleted_at is null`,
      [idOrNumber, userId],
    );
    if (!row) throw notFound('Order');
    return (await loadOrderDetail(row.id, 'customer'))!;
  },

  async cancelByCustomer(userId: string, orderId: string, reason?: string | null) {
    const after: AfterCommit = [];
    let needsRefund: string | null = null;
    await withTransaction(async (tx) => {
      const o = await lockOrder(tx, orderId);
      if (o.user_id !== userId) throw notFound('Order');
      if (!CUSTOMER_CANCELLABLE.includes(o.status)) throw new AppError('ORDER_INVALID', 'This order is already being prepared and can no longer be cancelled. Please contact support.');
      const paid = o.payment_status === 'PAID';
      await transitionOrder(tx, orderId, 'CANCELLED', { actorId: userId, actorType: 'CUSTOMER', note: reason ?? 'Cancelled by customer', cancelReason: reason ?? 'Cancelled by customer' }, after);
      if (paid) needsRefund = orderId;
    });
    runAfterCommit(after);
    if (needsRefund) {
      const { refundsService } = await import('../payments/refunds.service.js');
      await refundsService.refundCancelledOrder(needsRefund, userId, 'CUSTOMER_REQUEST');
    }
    return (await loadOrderDetail(orderId, 'customer'))!;
  },

  /** Releases stock held by unpaid online orders past their payment window (scheduled job). */
  async expireUnpaidOrders(): Promise<number> {
    const due = await query<{ id: string }>(`select id from public.orders where status = 'PAYMENT_PENDING' and payment_expires_at < now() limit 100`);
    let n = 0;
    for (const { id } of due) {
      const after: AfterCommit = [];
      try {
        await withTransaction((tx) => transitionOrder(tx, id, 'CANCELLED', { actorType: 'SYSTEM', system: true, note: 'Payment not completed in time', cancelReason: 'Payment window expired' }, after));
        runAfterCommit(after);
        n++;
      } catch {
        /* status changed concurrently (e.g. payment just succeeded) — skip */
      }
    }
    return n;
  },
};
