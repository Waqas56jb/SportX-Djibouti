import type { ID, ISODate } from './common';
import type { OrderStatus } from './orders';

export type CustomerStatus = 'active' | 'inactive' | 'blocked';
export type CustomerGroup = 'all' | 'new' | 'returning' | 'high_value' | 'inactive';

export interface CustomerAddress {
  id: ID;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  district?: string;
  city: string;
  country: string;
  postalCode?: string;
  isDefault: boolean;
}

export interface CustomerWishlistItem {
  productId: ID;
  name: string;
  slug: string;
  price: number;
  status: string;
  image?: string;
  addedAt?: ISODate;
}

/** Lifetime stats returned by GET /admin/customers/:id. */
export interface CustomerStatsSummary {
  cancelledOrders: number;
  refundedTotal: number;
  reviews: number;
  tickets: number;
  openTickets: number;
}

export interface Customer {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  status: CustomerStatus;
  /** Computed segments (never 'all'). */
  groups: CustomerGroup[];
  ordersCount: number;
  totalSpent: number;
  averageOrder: number;
  lastOrderAt?: ISODate;
  lastLoginAt?: ISODate;
  /** City of the default (or first) address. */
  city?: string;
  /** Detail only — empty on list rows. */
  addresses: CustomerAddress[];
  /** Detail only — empty on list rows. */
  wishlistProductIds: ID[];
  /** Detail only. */
  wishlist?: CustomerWishlistItem[];
  /** Detail only. */
  stats?: CustomerStatsSummary;
  /** Detail only (list rows don't carry it). */
  marketingOptIn: boolean;
  notes?: string;
  joinedAt: ISODate;
}

/** Fields staff can edit (PATCH /admin/customers/:id). Email is owned by the customer; status has its own endpoint. */
export interface CustomerInput {
  firstName: string;
  lastName: string;
  phone: string;
  marketingOptIn: boolean;
  notes?: string;
}

export interface CustomerActivity {
  id: ID;
  customerId: ID;
  type: 'account_created' | 'order_placed' | 'order_status' | 'review_posted' | 'ticket_opened' | 'wishlist_added' | 'status_changed' | 'login';
  title: string;
  description?: string;
  link?: string;
  createdAt: ISODate;
}

/** Row of GET /admin/customers/:id/orders (order summary). */
export interface CustomerOrder {
  id: ID;
  number: string;
  /** Lower-case order status, e.g. 'payment_pending'. */
  status: OrderStatus;
  paymentStatus: string;
  itemsCount: number;
  total: number;
  image?: string;
  createdAt: ISODate;
}
