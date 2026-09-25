import type { Address } from './user';

export type OrderStatus =
  | 'created'
  | 'payment-confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out-for-delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type PaymentMethodType = 'card' | 'mobile-money' | 'cash-on-delivery';

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  image: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  compareAtPrice?: number;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Estimated business days, [min, max]. */
  eta: [number, number];
}

export interface Shipping {
  method: ShippingMethod;
  address: Omit<Address, 'id' | 'isDefault' | 'label'>;
  expectedDelivery: string;
}

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethodType;
  status: PaymentStatus;
  amount: number;
  currency: string;
  /** Masked reference only — never raw card data. */
  reference?: string;
  createdAt: string;
}

export interface OrderTimelineEvent {
  status: OrderStatus;
  date: string;
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
  items: OrderItem[];
  shipping: Shipping;
  payment: Payment;
  status: OrderStatus;
  timeline: OrderTimelineEvent[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  couponCode?: string;
  createdAt: string;
}
