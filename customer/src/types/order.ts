import type { Address } from './user';

/** Order lifecycle (API: PENDING, PAYMENT_PENDING, … REFUNDED — lower-kebab on the client). */
export type OrderStatus =
  | 'pending'
  | 'payment-pending'
  | 'payment-confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out-for-delivery'
  | 'delivered'
  | 'cancelled'
  | 'refund-requested'
  | 'refunded';

export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'partially-refunded';

export type PaymentMethodType = 'card' | 'mobile-money' | 'cash-on-delivery' | 'bank-transfer';

/** API payment method enum. */
export type ApiPaymentMethod = 'CARD' | 'MOBILE_MONEY' | 'CASH_ON_DELIVERY' | 'BANK_TRANSFER';

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  brand?: string;
  sku?: string;
  image: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  /** Price before promotions, when it was higher than the paid unit price. */
  compareAtPrice?: number;
  lineTotal: number;
}

export interface ShippingMethod {
  /** Method code (standard, express, pickup…). */
  id: string;
  name: string;
  description: string;
  price: number;
  /** Estimated business days, [min, max]. */
  eta: [number, number];
  requiresAddress?: boolean;
}

export interface Shipping {
  method: ShippingMethod;
  address: Omit<Address, 'id' | 'isDefault' | 'label'> | null;
  /** ISO date, when the courier has an estimate. */
  expectedDelivery: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  status?: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
}

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethodType;
  status: PaymentStatus;
  amount: number;
  currency: string;
  provider?: string;
  /** Masked reference only — never raw card data. */
  reference?: string;
  failureReason?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface OrderTimelineEvent {
  status: OrderStatus;
  /** ISO timestamp (API `timestamp`). */
  date: string;
  note?: string | null;
}

export interface OrderCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface Order {
  id: string;
  number: string;
  userId: string | null;
  customer: OrderCustomer;
  /** Empty for list summaries (`GET /orders`) — see `itemsCount` / `image`. */
  items: OrderItem[];
  itemsCount: number;
  /** First item image (list summaries). */
  image?: string | null;
  shipping: Shipping;
  payment: Payment;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  timeline: OrderTimelineEvent[];
  subtotal: number;
  productDiscount: number;
  /** Coupon discount. */
  discount: number;
  shippingCost: number;
  tax: number;
  total: number;
  refunded: number;
  couponCode?: string;
  customerNote?: string | null;
  canCancel: boolean;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  /** Online payments must complete before this time or the order is released. */
  paymentExpiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  /** True when built from a list summary (no items / addresses / timeline). */
  isSummary?: boolean;
}
