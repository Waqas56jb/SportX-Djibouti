import { shippingMethodDescription, shippingMethodName } from './shippingService';
import type {
  ApiPaymentMethod,
  CartIssue,
  CheckoutValidation,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethodOption,
  PaymentMethodType,
  PaymentStatus,
  PlaceOrderInput,
  ShippingOption,
} from '@/types';
import type { Pagination } from './api';
import { ApiError, api, requestPage } from './api';
import { toCartIssue, toCartTotals, toCoupon, type ApiCoupon, type ApiPriceIssue, type ApiTotals } from './cartService';

// ───────────────────────── API shapes ─────────────────────────

interface ApiOrderSummary {
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
  shippingMethodCode?: string | null;
  image: string | null;
  placedAt: string;
  updatedAt: string;
}

interface ApiOrderDetail extends ApiOrderSummary {
  items: {
    id: string;
    productId: string;
    variantId: string;
    productName: string;
    productSlug: string;
    brandName: string;
    sku: string;
    color: string;
    size: string;
    imageUrl: string | null;
    quantity: number;
    originalUnitPrice: number;
    unitPrice: number;
    discountTotal: number;
    lineTotal: number;
  }[];
  totals: {
    subtotal: number;
    productDiscount: number;
    couponCode: string | null;
    couponDiscount: number;
    shipping: number;
    tax: number;
    grandTotal: number;
    refunded: number;
    net: number;
  };
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
    currency: string;
    cardBrand: string | null;
    cardLast4: string | null;
    paidAt: string | null;
    failureReason: string | null;
  } | null;
  timeline: { status: string; timestamp: string; note?: string | null }[];
  canCancel?: boolean;
  customerNote: string | null;
  paymentExpiresAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

interface ApiShippingQuote {
  methodId: string;
  code: string;
  name: string;
  fee: number;
  isFree: boolean;
  description?: string;
  requiresAddress?: boolean;
  carrier?: string | null;
  estimatedDelivery?: { minDays: number; maxDays: number; earliest: string; latest: string };
}

interface ApiValidation {
  valid: boolean;
  problems: { field: string; message: string }[];
  issues: ApiPriceIssue[];
  coupon: ApiCoupon | null;
  shipping: ApiShippingQuote | null;
  totals: ApiTotals;
  lines: { variantId: string }[];
  shippingOptions: ApiShippingQuote[];
  paymentMethods: { method: ApiPaymentMethod; provider: string; label: string }[];
}

// ───────────────────────── Adapters ─────────────────────────

const kebab = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/_/g, '-');

export const toOrderStatus = (s: string) => kebab(s) as OrderStatus;
export const toPaymentStatus = (s: string) => kebab(s) as PaymentStatus;
export const toPaymentMethodType = (m: string) => kebab(m) as PaymentMethodType;
export const toApiPaymentMethod = (m: PaymentMethodType) => m.toUpperCase().replace(/-/g, '_') as ApiPaymentMethod;

export function toPaymentMethodOption(m: { method: ApiPaymentMethod; provider: string; label: string }): PaymentMethodOption {
  return { method: m.method, type: toPaymentMethodType(m.method), provider: m.provider, label: m.label };
}

export function toShippingOption(q: ApiShippingQuote): ShippingOption {
  return {
    methodId: q.methodId,
    code: q.code,
    name: shippingMethodName(q.code, q.name),
    description: shippingMethodDescription(q.code, q.description ?? ''),
    fee: q.fee,
    isFree: q.isFree,
    requiresAddress: q.requiresAddress ?? true,
    carrier: q.carrier ?? null,
    minDays: q.estimatedDelivery?.minDays ?? 0,
    maxDays: q.estimatedDelivery?.maxDays ?? 0,
    earliest: q.estimatedDelivery?.earliest ?? null,
    latest: q.estimatedDelivery?.latest ?? null,
  };
}

function baseOrder(o: ApiOrderSummary): Order {
  const status = toOrderStatus(o.status);
  return {
    id: o.id,
    number: o.orderNumber,
    userId: o.customer?.id ?? null,
    customer: {
      firstName: o.customer?.firstName ?? '',
      lastName: o.customer?.lastName ?? '',
      email: o.customer?.email ?? '',
      phone: o.customer?.phone ?? '',
    },
    items: [],
    itemsCount: o.itemsCount,
    image: o.image,
    shipping: {
      method: { id: o.shippingMethodCode ?? '', name: shippingMethodName(o.shippingMethodCode, o.shippingMethod), description: '', price: 0, eta: [0, 0] },
      address: null,
      expectedDelivery: null,
      status: o.shippingStatus,
    },
    payment: {
      id: '',
      orderId: o.id,
      method: toPaymentMethodType(o.paymentMethod),
      status: toPaymentStatus(o.paymentStatus),
      amount: o.grandTotal,
      currency: o.currency,
      createdAt: o.placedAt,
    },
    status,
    paymentStatus: toPaymentStatus(o.paymentStatus),
    timeline: [],
    subtotal: o.grandTotal,
    productDiscount: 0,
    discount: 0,
    shippingCost: 0,
    tax: 0,
    total: o.grandTotal,
    refunded: o.refundedTotal ?? 0,
    canCancel: status === 'pending' || status === 'payment-pending' || status === 'payment-confirmed',
    createdAt: o.placedAt,
    updatedAt: o.updatedAt,
    isSummary: true,
  };
}

export function toOrder(o: ApiOrderDetail): Order {
  const base = baseOrder(o);
  const a = o.shipping?.address;
  const items: OrderItem[] = (o.items ?? []).map((i) => ({
    id: i.id,
    productId: i.productId,
    variantId: i.variantId,
    slug: i.productSlug,
    name: i.productName,
    brand: i.brandName,
    sku: i.sku,
    image: i.imageUrl ?? '',
    color: i.color,
    size: i.size,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    compareAtPrice: i.originalUnitPrice > i.unitPrice ? i.originalUnitPrice : undefined,
    lineTotal: i.lineTotal,
  }));
  const p = o.payment;
  return {
    ...base,
    items,
    itemsCount: base.itemsCount || items.reduce((n, i) => n + i.quantity, 0),
    image: base.image ?? items[0]?.image ?? null,
    shipping: {
      method: {
        id: o.shipping?.methodCode ?? '',
        name: shippingMethodName(o.shipping?.methodCode, o.shipping?.methodName ?? o.shippingMethod),
        description: '',
        price: o.shipping?.cost ?? 0,
        eta: [0, 0],
        requiresAddress: Boolean(a),
      },
      address: a
        ? {
            firstName: a.firstName ?? '',
            lastName: a.lastName ?? '',
            phone: a.phone ?? '',
            line1: a.addressLine1 ?? '',
            line2: a.addressLine2 ?? undefined,
            district: a.district ?? undefined,
            city: a.city ?? '',
            country: a.country ?? '',
            postalCode: a.postalCode ?? undefined,
          }
        : null,
      expectedDelivery: o.shipping?.estimatedDeliveryAt ?? null,
      carrier: o.shipping?.carrier ?? null,
      trackingNumber: o.shipping?.trackingNumber ?? null,
      status: o.shipping?.status,
      shippedAt: o.shipping?.shippedAt ?? null,
      deliveredAt: o.shipping?.deliveredAt ?? null,
    },
    payment: p
      ? {
          id: p.id,
          orderId: o.id,
          method: toPaymentMethodType(p.method),
          status: toPaymentStatus(p.status),
          amount: p.amount,
          currency: p.currency,
          provider: p.provider,
          reference: p.cardLast4 ? `${p.cardBrand ? `${p.cardBrand.charAt(0).toUpperCase()}${p.cardBrand.slice(1)} ` : ''}•••• ${p.cardLast4}` : undefined,
          failureReason: p.failureReason,
          paidAt: p.paidAt,
          createdAt: o.createdAt,
        }
      : base.payment,
    timeline: (o.timeline ?? []).map((t) => ({ status: toOrderStatus(t.status), date: t.timestamp, note: t.note ?? null })),
    subtotal: o.totals?.subtotal ?? base.total,
    productDiscount: o.totals?.productDiscount ?? 0,
    discount: o.totals?.couponDiscount ?? 0,
    shippingCost: o.totals?.shipping ?? 0,
    tax: o.totals?.tax ?? 0,
    total: o.totals?.grandTotal ?? base.total,
    refunded: o.totals?.refunded ?? base.refunded,
    couponCode: o.totals?.couponCode ?? undefined,
    customerNote: o.customerNote,
    canCancel: o.canCancel ?? base.canCancel,
    cancelReason: o.cancelReason,
    cancelledAt: o.cancelledAt,
    paymentExpiresAt: o.paymentExpiresAt,
    createdAt: o.createdAt ?? base.createdAt,
    isSummary: false,
  };
}

export function toCheckoutValidation(v: ApiValidation): CheckoutValidation {
  const issues: CartIssue[] = (v.issues ?? []).map((i) => toCartIssue(i));
  return {
    valid: v.valid,
    problems: v.problems ?? [],
    issues,
    totals: toCartTotals(v.totals),
    coupon: toCoupon(v.coupon),
    shipping: v.shipping ? { code: v.shipping.code, name: shippingMethodName(v.shipping.code, v.shipping.name), fee: v.shipping.fee, isFree: v.shipping.isFree } : null,
    shippingOptions: (v.shippingOptions ?? []).map(toShippingOption),
    paymentMethods: (v.paymentMethods ?? []).map(toPaymentMethodOption),
  };
}

// ───────────────────────── Public API ─────────────────────────

export interface ListOrdersOptions {
  page?: number;
  limit?: number;
  status?: 'active' | 'delivered' | 'cancelled' | 'all';
  /** Also load each order's detail (items, address, timeline). Bounded by `limit`. */
  details?: boolean;
}

export interface CheckoutValidateInput {
  shippingMethod?: string;
  couponCode?: string | null;
  addressId?: string;
  address?: Partial<NonNullable<PlaceOrderInput['address']>>;
  paymentMethod?: ApiPaymentMethod;
}

export const orderService = {
  /** Server-driven checkout validation: authoritative totals, shipping options, payment methods and problems. */
  async validateCheckout(input: CheckoutValidateInput, signal?: AbortSignal): Promise<CheckoutValidation> {
    const res = await api.post<ApiValidation>('/checkout/validate', input, { signal });
    return toCheckoutValidation(res);
  },

  /**
   * Places the order from the signed-in customer's server cart (`POST /orders`).
   * `idempotencyKey` must be generated once per checkout attempt and reused on retries.
   */
  async create(input: PlaceOrderInput, idempotencyKey: string): Promise<Order> {
    return toOrder(await api.post<ApiOrderDetail>('/orders', input, { idempotencyKey }));
  },

  /** Owner-only order detail. Null when not found. */
  async getById(id: string): Promise<Order | null> {
    if (!id) return null;
    try {
      return toOrder(await api.get<ApiOrderDetail>(`/orders/${encodeURIComponent(id)}`));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) return null;
      throw err;
    }
  },

  /** One page of the customer's orders (summaries: no items — see `itemsCount` / `image`). */
  async listPage(opts: Omit<ListOrdersOptions, 'details'> = {}): Promise<{ orders: Order[]; pagination: Pagination }> {
    const res = await requestPage<ApiOrderSummary>('/orders', { query: { page: opts.page ?? 1, limit: opts.limit ?? 10, status: opts.status ?? 'all' } });
    return { orders: res.data.map(baseOrder), pagination: res.pagination };
  },

  /**
   * The signed-in customer's orders, newest first. Summaries by default; pass `{ details: true }`
   * to load items/address/timeline too. (Legacy positional args are ignored.)
   */
  async listForUser(opts?: ListOrdersOptions | string, _legacyEmail?: string): Promise<Order[]> {
    const o: ListOrdersOptions = typeof opts === 'object' && opts ? opts : {};
    const { orders } = await orderService.listPage({ page: o.page, limit: o.limit ?? 50, status: o.status });
    if (!o.details) return orders;
    const detailed = await Promise.all(orders.map((x) => orderService.getById(x.id).catch(() => null)));
    return detailed.map((d, i) => d ?? orders[i]);
  },

  /** Customer cancellation (allowed before the order is packed). */
  async cancel(id: string, reason?: string): Promise<Order> {
    return toOrder(await api.post<ApiOrderDetail>(`/orders/${encodeURIComponent(id)}/cancel`, { reason: reason?.trim() || null }));
  },
};
