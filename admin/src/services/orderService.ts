import type { Order, OrderFilters, OrderStatus, OrderTimelineEvent, RefundInput, ShippingUpdateInput } from '@/types';
import { appConfig } from '@/constants/config';
import { ORDER_STATUS, SHIPPING_STATUS } from '@/constants/status';
import { uid } from '@/utils/id';
import { formatMoney } from '@/utils/format';
import { api, ApiError } from './http';
import { audit, db, delay, getActor, matches, NotFoundError, now } from './mock/db';

/** Allowed manual transitions. The backend must enforce the same rules. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'processing', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

function find(id: string): Order {
  const o = db.orders.find((x) => x.id === id || x.number === id);
  if (!o) throw new NotFoundError('Order');
  return o;
}

function pushEvent(o: Order, ev: Omit<OrderTimelineEvent, 'id' | 'createdAt' | 'actor' | 'actorType'> & Partial<Pick<OrderTimelineEvent, 'actorType'>>) {
  const actor = getActor();
  o.timeline.push({ id: uid('ev'), actor: actor.name, actorType: ev.actorType ?? 'admin', createdAt: now(), ...ev });
  o.updatedAt = now();
}

export const orderService = {
  /** GET /orders */
  async getOrders(filters: OrderFilters = {}): Promise<Order[]> {
    if (!appConfig.useMocks) return api.get<Order[]>('/orders', { ...filters });
    const list = db.orders
      .filter((o) => matches([o.number, o.customerName, o.customerEmail, o.customerPhone, o.customerPhone.replace(/\s/g, '')], filters.search))
      .filter((o) => !filters.status || o.status === filters.status || (filters.status === 'shipped' && o.status === 'out_for_delivery'))
      .filter((o) => !filters.paymentStatus || o.payment.status === filters.paymentStatus)
      .filter((o) => !filters.shippingStatus || o.shipping.status === filters.shippingStatus)
      .filter((o) => !filters.from || o.createdAt >= filters.from)
      .filter((o) => !filters.to || o.createdAt <= filters.to)
      .filter((o) => filters.minTotal === undefined || o.total >= filters.minTotal)
      .filter((o) => filters.maxTotal === undefined || o.total <= filters.maxTotal)
      .filter((o) => !filters.customerId || o.customerId === filters.customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return delay(list);
  },

  /** GET /orders/:id (accepts id or order number) */
  async getOrder(id: string): Promise<Order> {
    if (!appConfig.useMocks) return api.get<Order>(`/orders/${id}`);
    return delay(find(id));
  },

  /** GET /orders/counts — per-status counts for tabs. */
  async getStatusCounts(): Promise<Record<OrderStatus | 'all', number>> {
    if (!appConfig.useMocks) return api.get('/orders/counts');
    const counts = { all: db.orders.length } as Record<OrderStatus | 'all', number>;
    for (const s of Object.keys(ORDER_STATUS) as OrderStatus[]) counts[s] = db.orders.filter((o) => o.status === s).length;
    return delay(counts, 150);
  },

  /** PATCH /orders/:id/status */
  async updateOrderStatus(id: string, status: OrderStatus, note?: string): Promise<Order> {
    if (!appConfig.useMocks) return api.patch<Order>(`/orders/${id}/status`, { status, note });
    const o = find(id);
    if (!ORDER_TRANSITIONS[o.status].includes(status)) throw new ApiError(`Cannot move an order from ${ORDER_STATUS[o.status].label} to ${ORDER_STATUS[status].label}.`, 400, 'invalid_transition');
    o.status = status;
    if (status === 'shipped') {
      o.shipping.status = 'in_transit';
      o.shipping.shippedAt = now();
      if (o.payment.status === 'authorized') o.payment.status = 'paid';
    }
    if (status === 'packed') o.shipping.status = 'label_created';
    if (status === 'out_for_delivery') o.shipping.status = 'out_for_delivery';
    if (status === 'delivered') {
      o.shipping.status = 'delivered';
      o.shipping.deliveredAt = now();
      if (o.payment.method === 'cash_on_delivery' && o.payment.status === 'pending') {
        o.payment.status = 'paid';
        o.payment.paidAt = now();
      }
    }
    if (status === 'cancelled') {
      o.shipping.status = 'not_shipped';
      // Release reserved stock back to available.
      for (const it of o.items) {
        const v = db.products.flatMap((p) => p.variants).find((x) => x.id === it.variantId);
        if (v) v.reserved = Math.max(0, v.reserved - it.quantity);
      }
      if (o.payment.status === 'authorized') o.payment.status = 'refunded';
    }
    pushEvent(o, { kind: status, title: ORDER_STATUS[status].label, description: note || undefined });
    audit('Order status changed', 'Orders', `${o.number} → ${ORDER_STATUS[status].label}`, `/orders/${o.id}`);
    return delay(o, 500);
  },

  /** POST /orders/:id/refunds — frontend phase records the request only; no money moves. */
  async createRefund(input: RefundInput): Promise<Order> {
    if (!appConfig.useMocks) return api.post<Order>(`/orders/${input.orderId}/refunds`, input);
    const o = find(input.orderId);
    const refundable = o.payment.amount - o.payment.refundedAmount;
    if (!['paid', 'partially_refunded', 'refund_pending'].includes(o.payment.status)) throw new ApiError('Only captured payments can be refunded.', 400);
    if (input.amount <= 0 || input.amount > refundable) throw new ApiError(`Refund amount must be between 1 and ${formatMoney(refundable)}.`, 400);
    const actor = getActor();
    o.refunds.push({ id: uid('rf'), orderId: o.id, amount: input.amount, reason: input.reason, note: input.note, status: 'completed', requestedBy: actor.name, createdAt: now() });
    o.payment.refundedAmount += input.amount;
    const full = o.payment.refundedAmount >= o.payment.amount;
    o.payment.status = full ? 'refunded' : 'partially_refunded';
    for (const r of o.refunds) if (r.status === 'requested') r.status = 'completed';
    if (full) o.status = 'refunded';
    if (input.restock) {
      for (const it of o.items) {
        const v = db.products.flatMap((p) => p.variants).find((x) => x.id === it.variantId);
        if (v) v.stock += it.quantity;
      }
    }
    pushEvent(o, { kind: 'refund_completed', title: full ? 'Refund issued (full)' : 'Partial refund issued', description: `${formatMoney(input.amount)}${input.note ? ` — ${input.note}` : ''}` });
    audit('Refund issued', 'Orders', `${o.number} (${formatMoney(input.amount)})`, `/orders/${o.id}`);
    return delay(o, 700);
  },

  /** PATCH /orders/:id/shipping */
  async updateShipping(id: string, input: ShippingUpdateInput): Promise<Order> {
    if (!appConfig.useMocks) return api.patch<Order>(`/orders/${id}/shipping`, input);
    const o = find(id);
    const hadTracking = Boolean(o.shipping.trackingNumber);
    Object.assign(o.shipping, Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)));
    if (input.trackingNumber && !hadTracking) {
      pushEvent(o, { kind: 'tracking_added', title: 'Tracking number added', description: `${input.carrier ?? o.shipping.carrier ?? 'Carrier'} · ${input.trackingNumber}` });
      audit('Tracking number added', 'Orders', o.number, `/orders/${o.id}`);
    } else if (input.status) {
      pushEvent(o, { kind: 'note', title: `Shipping: ${SHIPPING_STATUS[input.status].label}` });
      audit('Shipping updated', 'Orders', o.number, `/orders/${o.id}`);
    }
    return delay(o);
  },

  /** POST /orders/:id/notes */
  async addNote(id: string, note: string): Promise<Order> {
    if (!appConfig.useMocks) return api.post<Order>(`/orders/${id}/notes`, { note });
    const o = find(id);
    pushEvent(o, { kind: 'note', title: 'Internal note', description: note });
    return delay(o, 250);
  },

  /** GET /orders/:id/invoice — backend will return a PDF. Frontend phase prints the page. */
  invoiceUrl(id: string) {
    return `${appConfig.apiBaseUrl}/orders/${id}/invoice.pdf`;
  },
};
