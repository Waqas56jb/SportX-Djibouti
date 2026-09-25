import type { ID, ISODate } from './common';
import type { ProductType } from './catalog';

export type OrderStatus =
  | 'pending'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded';
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'partially_refunded' | 'refunded' | 'cancelled';
export type ShippingStatus = 'pending' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'returned';
export type PaymentMethod = 'card' | 'mobile_money' | 'cash_on_delivery' | 'bank_transfer';

export interface OrderItem {
  id: ID;
  productId: ID;
  variantId: ID;
  productName: string;
  productSlug?: string;
  brandName?: string;
  productType?: ProductType;
  variantLabel: string;
  sku: string;
  image?: string;
  quantity: number;
  /** Price before product discounts. */
  originalUnitPrice?: number;
  unitPrice: number;
  discount?: number;
  subtotal: number;
}

/** Non-sensitive payment record. Never holds PAN, CVV or provider secrets. */
export interface Payment {
  id: ID;
  method: PaymentMethod;
  provider: string;
  status: PaymentStatus;
  amount: number;
  refundedAmount: number;
  currency: string;
  transactionRef: string;
  cardBrand?: string;
  cardLast4?: string;
  paidAt?: ISODate;
  failureReason?: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  district?: string;
  city: string;
  country: string;
  postalCode?: string;
}

export interface Shipping {
  method: string;
  methodCode?: string;
  carrier?: string;
  trackingNumber?: string;
  status: ShippingStatus;
  cost: number;
  estimatedDelivery?: ISODate;
  shippedAt?: ISODate;
  deliveredAt?: ISODate;
  /** Null for pickup orders without a delivery address. */
  address: ShippingAddress | null;
}

export type TimelineEventKind = OrderStatus | 'created' | 'payment' | 'payment_failed' | 'note' | 'tracking_added' | 'refund_completed';

export interface OrderTimelineEvent {
  id: ID;
  kind: TimelineEventKind;
  title: string;
  description?: string;
  actor: string;
  actorType: 'system' | 'admin' | 'customer';
  createdAt: ISODate;
}

export type RefundReason = 'customer_request' | 'damaged_item' | 'wrong_item' | 'payment_issue' | 'other';
export type RefundStatus = 'requested' | 'processing' | 'completed' | 'failed';

export interface Refund {
  id: ID;
  orderId: ID;
  amount: number;
  reason: RefundReason;
  note?: string;
  status: RefundStatus;
  restock?: boolean;
  providerReference?: string;
  failureReason?: string;
  requestedBy: string;
  createdAt: ISODate;
}

export interface Order {
  id: ID;
  number: string;
  /** Null for orders whose customer account was removed. */
  customerId: ID | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** Empty on list rows — only the detail endpoint returns line items. */
  items: OrderItem[];
  itemsCount: number;
  image?: string;
  subtotal: number;
  /** Product discounts + coupon discount. */
  discount: number;
  productDiscount: number;
  couponDiscount: number;
  couponCode?: string;
  shippingCost: number;
  tax: number;
  total: number;
  refundedTotal: number;
  currency: string;
  status: OrderStatus;
  payment: Payment;
  shipping: Shipping;
  timeline: OrderTimelineEvent[];
  refunds: Refund[];
  customerNote?: string;
  cancelReason?: string;
  cancelledAt?: ISODate;
  paymentExpiresAt?: ISODate;
  /** Server-computed manual transitions (detail only). Undefined on list rows. */
  allowedTransitions?: OrderStatus[];
  /** True when this object came from the list endpoint (summary row, no items/timeline). */
  summary?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type OrderSortField = 'placed_at' | 'grand_total' | 'order_number' | 'status';

export interface OrderFilters {
  search?: string;
  status?: OrderStatus | '';
  paymentStatus?: PaymentStatus | '';
  shippingStatus?: ShippingStatus | '';
  paymentMethod?: PaymentMethod | '';
  from?: ISODate;
  to?: ISODate;
  minTotal?: number;
  maxTotal?: number;
  customerId?: ID;
  page?: number;
  pageSize?: number;
  sortBy?: OrderSortField;
  sortDir?: 'asc' | 'desc';
}

export type OrderCounts = Record<OrderStatus | 'all' | 'needs_action' | 'refund_requests', number>;

export interface RefundInput {
  orderId: ID;
  type: 'full' | 'partial';
  /** Required for partial refunds; ignored for full refunds (the server refunds the remaining balance). */
  amount?: number;
  reason: RefundReason;
  note?: string;
  restock: boolean;
  /** Reuse the same key when retrying the same refund so it is never issued twice. */
  idempotencyKey: string;
}

export interface CancelOrderInput {
  reason: string;
  /** Refund captured payments automatically. */
  refund: boolean;
}

export interface ShippingUpdateInput {
  carrier?: string;
  trackingNumber?: string;
  /** ISO datetime, or null to clear. */
  estimatedDelivery?: ISODate | null;
}
