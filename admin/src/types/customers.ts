import type { ID, ISODate } from './common';

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

export interface Customer {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  status: CustomerStatus;
  groups: CustomerGroup[];
  ordersCount: number;
  totalSpent: number;
  averageOrder: number;
  lastOrderAt?: ISODate;
  addresses: CustomerAddress[];
  wishlistProductIds: ID[];
  marketingOptIn: boolean;
  notes?: string;
  joinedAt: ISODate;
}

export type CustomerInput = Pick<Customer, 'firstName' | 'lastName' | 'email' | 'phone' | 'status' | 'marketingOptIn' | 'notes'>;

export interface CustomerActivity {
  id: ID;
  customerId: ID;
  type: 'account_created' | 'order_placed' | 'review_posted' | 'ticket_opened' | 'wishlist_added' | 'status_changed' | 'login';
  title: string;
  description?: string;
  link?: string;
  createdAt: ISODate;
}
