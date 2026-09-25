import type { ID, ISODate } from './common';
import type { ProductType } from './catalog';

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refund_pending' | 'refunded' | 'partially_refunded';
export type ShippingStatus = 'not_shipped' | 'label_created' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned';
export type PaymentMethod = 'card' | 'mobile_money' | 'cash_on_delivery' | 'bank_transfer';

export interface OrderItem {
  id: ID;
  productId: ID;
  variantId: ID;
  productName: string;
  productType: ProductType;
  variantLabel: string;
  sku: string;
  image?: string;
  quantity: number;
  unitPrice: number;
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
  carrier?: string;
  trackingNumber?: string;
  status: ShippingStatus;
  cost: number;
  estimatedDelivery?: ISODate;
  shippedAt?: ISODate;
  deliveredAt?: ISODate;
  address: ShippingAddress;
}

export type TimelineEventKind =
  | OrderStatus
  | 'created'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'note'
  | 'tracking_added'
  | 'refund_requested'
  | 'refund_completed';

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

export interface Refund {
  id: ID;
  orderId: ID;
  amount: number;
  reason: RefundReason;
  note?: string;
  status: 'requested' | 'processing' | 'completed' | 'rejected';
  requestedBy: string;
  createdAt: ISODate;
}

export interface Order {
  id: ID;
  number: string;
  customerId: ID;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  itemsCount: number;
  subtotal: number;
  discount: number;
  couponCode?: string;
  shippingCost: number;
  tax: number;
  total: number;
  currency: string;
  status: OrderStatus;
  payment: Payment;
  shipping: Shipping;
  timeline: OrderTimelineEvent[];
  refunds: Refund[];
  customerNote?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface OrderFilters {
  search?: string;
  status?: OrderStatus | '';
  paymentStatus?: PaymentStatus | '';
  shippingStatus?: ShippingStatus | '';
  from?: ISODate;
  to?: ISODate;
  minTotal?: number;
  maxTotal?: number;
  customerId?: ID;
}

export interface RefundInput {
  orderId: ID;
  type: 'full' | 'partial';
  amount: number;
  reason: RefundReason;
  note?: string;
  restock: boolean;
}

export interface ShippingUpdateInput {
  carrier?: string;
  trackingNumber?: string;
  status?: ShippingStatus;
  estimatedDelivery?: ISODate;
}
