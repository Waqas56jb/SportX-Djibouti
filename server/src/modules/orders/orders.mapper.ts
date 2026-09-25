import { query, queryOne, type Db, pool } from '../../config/database.js';
import { ORDER_TRANSITIONS, MANUAL_STATUSES, CUSTOMER_CANCELLABLE } from './order.state.js';
import type { OrderStatus } from '../../types/common.js';

const iso = (v: Date | string | null | undefined) => (v ? new Date(v).toISOString() : null);

export interface OrderRow {
  id: string;
  order_number: string;
  user_id: string | null;
  email: string;
  phone: string;
  customer_first_name: string;
  customer_last_name: string;
  status: OrderStatus;
  payment_status: string;
  payment_method: string;
  shipping_status: string;
  currency: string;
  subtotal: number;
  product_discount_total: number;
  coupon_code: string | null;
  coupon_discount: number;
  shipping_total: number;
  tax_total: number;
  grand_total: number;
  refunded_total: number;
  items_count: number;
  shipping_method_code: string;
  shipping_method_name: string;
  shipping_address: Record<string, unknown> | null;
  customer_note: string | null;
  inventory_state: string;
  payment_expires_at: Date | null;
  placed_at: Date;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Compact row for tables and lists. */
export function toOrderSummary(o: OrderRow & { first_item_image?: string | null }) {
  return {
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    paymentStatus: o.payment_status,
    paymentMethod: o.payment_method,
    shippingStatus: o.shipping_status,
    customer: { id: o.user_id, firstName: o.customer_first_name, lastName: o.customer_last_name, email: o.email, phone: o.phone },
    itemsCount: o.items_count,
    currency: o.currency,
    grandTotal: o.grand_total,
    refundedTotal: o.refunded_total,
    shippingMethod: o.shipping_method_name,
    image: o.first_item_image ?? null,
    placedAt: iso(o.placed_at)!,
    updatedAt: iso(o.updated_at)!,
  };
}

/**
 * Full order view. `audience` controls what is exposed: customers never see internal notes,
 * staff user ids, provider payment ids or inventory internals.
 */
export async function loadOrderDetail(orderId: string, audience: 'customer' | 'admin', db: Db = pool) {
  const o = await queryOne<OrderRow>(`select * from public.orders where id = $1 and deleted_at is null`, [orderId], db);
  if (!o) return null;
  const [items, history, shipping, payments, refunds, events] = await Promise.all([
    query<Record<string, unknown>>(`select * from public.order_items where order_id = $1 order by created_at, id`, [orderId], db),
    query<{ status: OrderStatus; note: string | null; actor_type: string; created_at: Date; changed_by_name: string | null }>(
      `select h.status, h.note, h.actor_type, h.created_at, nullif(trim(u.first_name || ' ' || u.last_name), '') as changed_by_name
         from public.order_status_history h left join public.users u on u.id = h.changed_by
        where h.order_id = $1 order by h.created_at, h.id`,
      [orderId],
      db,
    ),
    queryOne<Record<string, unknown>>(`select * from public.shipping where order_id = $1`, [orderId], db),
    query<Record<string, unknown>>(`select * from public.payments where order_id = $1 order by created_at desc`, [orderId], db),
    query<Record<string, unknown>>(`select r.*, nullif(trim(u.first_name || ' ' || u.last_name), '') as requested_by_name from public.refunds r left join public.users u on u.id = r.requested_by where r.order_id = $1 order by r.created_at desc`, [orderId], db),
    audience === 'admin'
      ? query<Record<string, unknown>>(`select e.*, nullif(trim(u.first_name || ' ' || u.last_name), '') as actor_name from public.order_events e left join public.users u on u.id = e.actor_id where e.order_id = $1 order by e.created_at`, [orderId], db)
      : Promise.resolve([]),
  ]);
  const payment = payments[0];
  const isAdmin = audience === 'admin';

  return {
    ...toOrderSummary(o),
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      variantId: i.variant_id,
      productName: i.product_name,
      productSlug: i.product_slug,
      brandName: i.brand_name,
      sku: i.sku,
      color: i.color,
      size: i.size,
      imageUrl: i.image_url,
      quantity: i.quantity,
      originalUnitPrice: i.original_unit_price,
      unitPrice: i.unit_price,
      discountTotal: i.discount_total,
      lineTotal: i.line_total,
    })),
    totals: {
      subtotal: o.subtotal,
      productDiscount: o.product_discount_total,
      couponCode: o.coupon_code,
      couponDiscount: o.coupon_discount,
      shipping: o.shipping_total,
      tax: o.tax_total,
      grandTotal: o.grand_total,
      refunded: o.refunded_total,
      net: o.grand_total - o.refunded_total,
    },
    shipping: {
      methodCode: o.shipping_method_code,
      methodName: o.shipping_method_name,
      carrier: (shipping?.carrier as string | null) ?? null,
      trackingNumber: (shipping?.tracking_number as string | null) ?? null,
      status: (shipping?.status as string) ?? o.shipping_status,
      cost: o.shipping_total,
      estimatedDeliveryAt: iso(shipping?.estimated_delivery_at as Date | null),
      shippedAt: iso(shipping?.shipped_at as Date | null),
      deliveredAt: iso(shipping?.delivered_at as Date | null),
      address: o.shipping_address,
    },
    payment: payment
      ? {
          id: payment.id,
          provider: payment.provider,
          method: payment.method,
          status: payment.status,
          amount: payment.amount,
          refundedAmount: payment.refunded_amount,
          currency: payment.currency,
          cardBrand: payment.card_brand,
          cardLast4: payment.card_last4,
          paidAt: iso(payment.paid_at as Date | null),
          failureReason: payment.failure_reason,
          ...(isAdmin ? { providerPaymentId: payment.provider_payment_id, createdAt: iso(payment.created_at as Date) } : {}),
        }
      : null,
    timeline: history.map((h) => ({
      status: h.status,
      timestamp: iso(h.created_at)!,
      actorType: h.actor_type,
      ...(isAdmin ? { note: h.note, actor: h.changed_by_name ?? (h.actor_type === 'SYSTEM' ? 'System' : h.actor_type === 'CUSTOMER' ? 'Customer' : 'Staff') } : { note: h.actor_type === 'ADMIN' ? null : h.note }),
    })),
    refunds: refunds.map((r) => ({
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      status: r.status,
      createdAt: iso(r.created_at as Date),
      ...(isAdmin ? { note: r.note, providerReference: r.provider_reference, restock: r.restock, requestedBy: r.requested_by_name, failureReason: r.failure_reason } : {}),
    })),
    ...(isAdmin
      ? {
          events: events.map((e) => ({ id: e.id, kind: e.kind, title: e.title, description: e.description, actor: e.actor_name ?? 'System', actorType: e.actor_type, createdAt: iso(e.created_at as Date) })),
          allowedTransitions: ORDER_TRANSITIONS[o.status].filter((s) => MANUAL_STATUSES.includes(s)),
          inventoryState: o.inventory_state,
        }
      : { canCancel: CUSTOMER_CANCELLABLE.includes(o.status) }),
    customerNote: o.customer_note,
    paymentExpiresAt: iso(o.payment_expires_at),
    cancelledAt: iso(o.cancelled_at),
    cancelReason: o.cancel_reason,
    createdAt: iso(o.created_at)!,
  };
}
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof loadOrderDetail>>>;
