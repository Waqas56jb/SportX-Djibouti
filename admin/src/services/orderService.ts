import type {
  CancelOrderInput,
  Order,
  OrderCounts,
  OrderFilters,
  OrderItem,
  OrderStatus,
  OrderTimelineEvent,
  Paginated,
  PaymentMethod,
  PaymentStatus,
  Refund,
  RefundInput,
  RefundReason,
  ShippingAddress,
  ShippingStatus,
  ShippingUpdateInput,
  TimelineEventKind,
} from '@/types';
import { ORDER_STATUS } from '@/constants/status';
import { adminApi, request } from './api';

/**
 * Manual transitions staff may request (mirrors the server's ORDER_TRANSITIONS ∩ MANUAL_STATUSES).
 * Used only for list rows; the detail view uses the server's `allowedTransitions`, and the
 * server always has the final say.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  payment_pending: ['cancelled'],
  payment_confirmed: ['processing', 'cancelled', 'refund_requested'],
  processing: ['packed', 'cancelled', 'refund_requested'],
  packed: ['shipped', 'processing', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
  delivered: ['refund_requested'],
  refund_requested: ['delivered', 'processing'],
  cancelled: [],
  refunded: [],
};

// ─── DTOs (server shapes) ──────────────────────────────────────────────────

interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  shippingStatus: string;
  customer: { id: string | null; firstName: string; lastName: string; email: string; phone: string };
  itemsCount: number;
  currency: string;
  grandTotal: number;
  refundedTotal: number;
  shippingMethod: string;
  image: string | null;
  placedAt: string;
  updatedAt: string;
}

interface OrderDetailDto extends OrderSummaryDto {
  items: {
    id: string;
    productId: string;
    variantId: string;
    productName: string;
    productSlug: string | null;
    brandName: string | null;
    sku: string;
    color: string | null;
    size: string | null;
    imageUrl: string | null;
    quantity: number;
    originalUnitPrice: number;
    unitPrice: number;
    discountTotal: number;
    lineTotal: number;
  }[];
  totals: { subtotal: number; productDiscount: number; couponCode: string | null; couponDiscount: number; shipping: number; tax: number; grandTotal: number; refunded: number; net: number };
  shipping: {
    methodCode: string;
    methodName: string;
    carrier: string | null;
    trackingNumber: string | null;
    status: string;
    cost: number;
    estimatedDeliveryAt: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    address: Record<string, string | null> | null;
  };
  payment: {
    id: string;
    provider: string;
    method: string;
    status: string;
    amount: number;
    refundedAmount: number;
    currency: string;
    cardBrand: string | null;
    cardLast4: string | null;
    paidAt: string | null;
    failureReason: string | null;
    providerPaymentId?: string | null;
  } | null;
  timeline: { status: string; timestamp: string; actorType: string; note: string | null; actor: string }[];
  refunds: { id: string; amount: number; reason: string; status: string; createdAt: string; note?: string | null; providerReference?: string | null; restock?: boolean; requestedBy?: string | null; failureReason?: string | null }[];
  events: { id: string; kind: string; title: string; description: string | null; actor: string; actorType: string; createdAt: string }[];
  allowedTransitions: string[];
  customerNote: string | null;
  paymentExpiresAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

// ─── Mapping ───────────────────────────────────────────────────────────────

const lower = <T extends string>(v: string | null | undefined, fallback: T): T => (v ? (v.toLowerCase() as T) : fallback);
const upper = (v: string | undefined | null) => (v ? v.toUpperCase() : undefined);
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
const actorType = (v: string | null | undefined): OrderTimelineEvent['actorType'] => (v === 'ADMIN' ? 'admin' : v === 'CUSTOMER' ? 'customer' : 'system');

function mapAddress(a: Record<string, string | null> | null): ShippingAddress | null {
  if (!a) return null;
  return {
    fullName: [a.firstName, a.lastName].filter(Boolean).join(' '),
    phone: a.phone ?? '',
    line1: a.addressLine1 ?? '',
    line2: a.addressLine2 ?? undefined,
    district: a.district ?? undefined,
    city: a.city ?? '',
    country: a.country ?? '',
    postalCode: a.postalCode ?? undefined,
  };
}

function mapSummary(d: OrderSummaryDto): Order {
  const method = lower<PaymentMethod>(d.paymentMethod, 'card');
  return {
    id: d.id,
    number: d.orderNumber,
    customerId: d.customer.id,
    customerName: `${d.customer.firstName ?? ''} ${d.customer.lastName ?? ''}`.trim() || d.customer.email,
    customerEmail: d.customer.email,
    customerPhone: d.customer.phone ?? '',
    items: [],
    itemsCount: d.itemsCount,
    image: opt(d.image),
    subtotal: d.grandTotal,
    discount: 0,
    productDiscount: 0,
    couponDiscount: 0,
    shippingCost: 0,
    tax: 0,
    total: d.grandTotal,
    refundedTotal: d.refundedTotal,
    currency: d.currency,
    status: lower<OrderStatus>(d.status, 'pending'),
    payment: {
      id: '',
      method,
      provider: '',
      status: lower<PaymentStatus>(d.paymentStatus, 'pending'),
      amount: d.grandTotal,
      refundedAmount: d.refundedTotal,
      currency: d.currency,
      transactionRef: '',
    },
    shipping: { method: d.shippingMethod, status: lower<ShippingStatus>(d.shippingStatus, 'pending'), cost: 0, address: null },
    timeline: [],
    refunds: [],
    summary: true,
    createdAt: d.placedAt,
    updatedAt: d.updatedAt,
  };
}

/** Merges status history and order events (payments, tracking, refunds, notes) into one feed. */
function mapTimeline(d: OrderDetailDto): OrderTimelineEvent[] {
  const history: OrderTimelineEvent[] = d.timeline.map((h, i) => {
    const status = lower<OrderStatus>(h.status, 'pending');
    const first = i === 0;
    return {
      id: `h${i}-${h.timestamp}`,
      kind: first && (status === 'pending' || status === 'payment_pending') ? 'created' : status,
      title: first && (status === 'pending' || status === 'payment_pending') ? 'Order placed' : ORDER_STATUS[status]?.label ?? h.status,
      description: h.note ?? undefined,
      actor: h.actor,
      actorType: actorType(h.actorType),
      createdAt: h.timestamp,
    };
  });
  const EVENT_KIND: Record<string, TimelineEventKind> = { note: 'note', tracking: 'tracking_added', payment: 'payment', refund: 'refund_completed' };
  const events: OrderTimelineEvent[] = (d.events ?? []).map((e) => ({
    id: e.id,
    kind: e.kind === 'payment' && /fail/i.test(e.title) ? 'payment_failed' : (EVENT_KIND[e.kind] ?? 'note'),
    title: e.title,
    description: e.description ?? undefined,
    actor: e.actor,
    actorType: actorType(e.actorType),
    createdAt: e.createdAt,
  }));
  return [...history, ...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function mapDetail(d: OrderDetailDto): Order {
  const base = mapSummary(d);
  const t = d.totals;
  const items: OrderItem[] = d.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    variantId: i.variantId,
    productName: i.productName,
    productSlug: opt(i.productSlug),
    brandName: opt(i.brandName),
    variantLabel: [i.color, i.size].filter(Boolean).join(' / ') || 'Default',
    sku: i.sku,
    image: opt(i.imageUrl),
    quantity: i.quantity,
    originalUnitPrice: i.originalUnitPrice,
    unitPrice: i.unitPrice,
    discount: i.discountTotal,
    subtotal: i.lineTotal,
  }));
  const p = d.payment;
  const refunds: Refund[] = d.refunds.map((r) => ({
    id: r.id,
    orderId: d.id,
    amount: r.amount,
    reason: lower<RefundReason>(r.reason, 'other'),
    note: opt(r.note),
    status: lower<Refund['status']>(r.status, 'requested'),
    restock: r.restock,
    providerReference: opt(r.providerReference),
    failureReason: opt(r.failureReason),
    requestedBy: r.requestedBy ?? 'Staff',
    createdAt: r.createdAt,
  }));
  return {
    ...base,
    summary: false,
    items,
    subtotal: t.subtotal,
    productDiscount: t.productDiscount,
    couponDiscount: t.couponDiscount,
    discount: t.productDiscount + t.couponDiscount,
    couponCode: opt(t.couponCode),
    shippingCost: t.shipping,
    tax: t.tax,
    total: t.grandTotal,
    refundedTotal: t.refunded,
    payment: p
      ? {
          id: p.id,
          method: lower<PaymentMethod>(p.method, base.payment.method),
          provider: p.provider,
          // The order-level payment status is authoritative for the badge/actions.
          status: base.payment.status,
          amount: p.amount,
          refundedAmount: p.refundedAmount,
          currency: p.currency,
          transactionRef: p.providerPaymentId ?? '',
          cardBrand: opt(p.cardBrand),
          cardLast4: opt(p.cardLast4),
          paidAt: opt(p.paidAt),
          failureReason: opt(p.failureReason),
        }
      : { ...base.payment, amount: t.grandTotal, refundedAmount: t.refunded },
    shipping: {
      method: d.shipping.methodName,
      methodCode: d.shipping.methodCode,
      carrier: opt(d.shipping.carrier),
      trackingNumber: opt(d.shipping.trackingNumber),
      status: lower<ShippingStatus>(d.shipping.status, 'pending'),
      cost: d.shipping.cost,
      estimatedDelivery: opt(d.shipping.estimatedDeliveryAt),
      shippedAt: opt(d.shipping.shippedAt),
      deliveredAt: opt(d.shipping.deliveredAt),
      address: mapAddress(d.shipping.address),
    },
    timeline: mapTimeline(d),
    refunds,
    customerNote: opt(d.customerNote),
    cancelReason: opt(d.cancelReason),
    cancelledAt: opt(d.cancelledAt),
    paymentExpiresAt: opt(d.paymentExpiresAt),
    allowedTransitions: d.allowedTransitions.map((s) => lower<OrderStatus>(s, 'pending')),
    createdAt: d.placedAt ?? d.createdAt,
  };
}

function toQuery(f: OrderFilters) {
  return {
    page: f.page ?? 1,
    limit: f.pageSize ?? 20,
    search: f.search || undefined,
    status: upper(f.status),
    payment_status: upper(f.paymentStatus),
    shipping_status: upper(f.shippingStatus),
    payment_method: upper(f.paymentMethod),
    customer_id: f.customerId,
    date_from: f.from,
    date_to: f.to,
    min_total: f.minTotal,
    max_total: f.maxTotal,
    sort: f.sortBy,
    order: f.sortDir,
  };
}

// ─── Service ───────────────────────────────────────────────────────────────

export const orderService = {
  /** GET /admin/orders — one server page of summary rows. */
  async listOrders(filters: OrderFilters = {}, signal?: AbortSignal): Promise<Paginated<Order>> {
    const res = await adminApi.page<OrderSummaryDto>('/orders', toQuery(filters), signal);
    return { data: res.data.map(mapSummary), total: res.pagination.total, page: res.pagination.page, pageSize: res.pagination.limit };
  },

  /** Convenience for widgets: first page of summary rows (default 20). */
  async getOrders(filters: OrderFilters = {}): Promise<Order[]> {
    return (await orderService.listOrders(filters)).data;
  },

  /** GET /admin/orders/:id (accepts id or order number) */
  async getOrder(id: string): Promise<Order> {
    return mapDetail(await adminApi.get<OrderDetailDto>(`/orders/${encodeURIComponent(id)}`));
  },

  /** GET /admin/orders/counts — per-status counts for tabs. */
  async getStatusCounts(): Promise<OrderCounts> {
    const raw = await adminApi.get<Record<string, number>>('/orders/counts');
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v])) as OrderCounts;
  },

  /** PATCH /admin/orders/:id/status — the server validates the transition and applies side effects. */
  async updateOrderStatus(id: string, status: OrderStatus, note?: string): Promise<Order> {
    return mapDetail(await adminApi.patch<OrderDetailDto>(`/orders/${id}/status`, { status: status.toUpperCase(), note: note || undefined }));
  },

  /** POST /admin/orders/:id/cancel — releases or restocks inventory; optionally refunds captured payments. */
  async cancelOrder(id: string, input: CancelOrderInput): Promise<Order> {
    return mapDetail(await adminApi.post<OrderDetailDto>(`/orders/${id}/cancel`, input));
  },

  /** POST /admin/orders/:id/refund — idempotent via Idempotency-Key. Returns the refund status and the updated order. */
  async createRefund(input: RefundInput): Promise<{ order: Order; refundStatus: Refund['status'] }> {
    const res = await adminApi.post<{ refund: { status: string }; order: OrderDetailDto }>(
      `/orders/${input.orderId}/refund`,
      {
        type: input.type,
        amount: input.type === 'partial' ? input.amount : undefined,
        reason: input.reason.toUpperCase(),
        note: input.note || undefined,
        restock: input.restock,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return { order: mapDetail(res.order), refundStatus: lower<Refund['status']>(res.refund.status, 'processing') };
  },

  /** PATCH /admin/orders/:id/payment-status — offline methods (COD, bank transfer) only. */
  async setPaymentStatus(id: string, status: 'paid' | 'failed', note?: string): Promise<Order> {
    return mapDetail(await adminApi.patch<OrderDetailDto>(`/orders/${id}/payment-status`, { status: status.toUpperCase(), note: note || undefined }));
  },

  /** PATCH /admin/orders/:id/shipping — carrier, tracking number, ETA. */
  async updateShipping(id: string, input: ShippingUpdateInput): Promise<Order> {
    return mapDetail(
      await adminApi.patch<OrderDetailDto>(`/orders/${id}/shipping`, {
        carrier: input.carrier || undefined,
        trackingNumber: input.trackingNumber || undefined,
        estimatedDeliveryAt: input.estimatedDelivery,
      }),
    );
  },

  /** POST /admin/orders/:id/notes — internal note on the activity feed. */
  async addNote(id: string, note: string): Promise<Order> {
    return mapDetail(await adminApi.post<OrderDetailDto>(`/orders/${id}/notes`, { note }));
  },
};

/** Offline payment methods whose payment status staff may set manually. Card/mobile money are provider-confirmed. */
export const isOfflinePayment = (method: PaymentMethod) => method === 'cash_on_delivery' || method === 'bank_transfer';

// ─── Invoice branding ──────────────────────────────────────────────────────

export interface InvoiceBrand {
  name: string;
  tagline: string;
  addressLines: string[];
  phone: string;
  email: string;
  country: string;
  logoUrl: string | null;
}

let brandCache: { at: number; value: InvoiceBrand } | null = null;

/** Store identity for printed invoices, from the public GET /store settings (cached 5 min). */
export async function getInvoiceBrand(): Promise<InvoiceBrand> {
  if (brandCache && Date.now() - brandCache.at < 300_000) return brandCache.value;
  const s = await request<{ storeName: string; tagline: string | null; supportEmail: string | null; phone: string | null; address: string[]; country: string | null; logoUrl: string | null }>('/store');
  const value: InvoiceBrand = {
    name: s.storeName,
    tagline: s.tagline ?? '',
    addressLines: [...(s.address ?? []), s.country].filter((x): x is string => Boolean(x)),
    phone: s.phone ?? '',
    email: s.supportEmail ?? '',
    country: s.country ?? '',
    logoUrl: s.logoUrl,
  };
  brandCache = { at: Date.now(), value };
  return value;
}
