import type { ID, ISODate } from './common';
import type { ProductType } from './catalog';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

export interface Review {
  id: ID;
  productId: ID;
  productName: string;
  productSlug?: string;
  productType?: ProductType;
  productImage?: string;
  customerId: ID;
  customerName: string;
  customerEmail?: string;
  orderId?: ID;
  orderNumber?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  fit?: 'small' | 'true' | 'large';
  size?: string;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: ISODate;
  updatedAt?: ISODate;
  moderatedAt?: ISODate;
  moderatedBy?: string;
}

export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'order' | 'delivery' | 'return' | 'product' | 'payment' | 'account' | 'other';

export interface TicketMessage {
  id: ID;
  ticketId: ID;
  /** 'admin' covers staff and system messages. */
  authorType: 'customer' | 'admin';
  authorName: string;
  body: string;
  /** Internal notes are visible to staff only and never sent to the customer. */
  internal: boolean;
  createdAt: ISODate;
}

/** Customer summary included in GET /admin/support/tickets/:id. */
export interface TicketCustomer {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  status: string;
  deleted: boolean;
  ordersCount: number;
  totalSpent: number;
  joinedAt: ISODate;
}

export interface SupportTicket {
  id: ID;
  number: string;
  subject: string;
  customerId: ID;
  customerName: string;
  customerEmail: string;
  orderId?: ID;
  orderNumber?: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedToId?: ID;
  assignedToName?: string;
  /** Full thread on the detail endpoint; empty on list rows (use messageCount / lastMessage). */
  messages: TicketMessage[];
  messageCount?: number;
  lastMessage?: { author: 'customer' | 'admin'; preview: string; createdAt: ISODate };
  customer?: TicketCustomer;
  closedAt?: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type NotificationType =
  | 'low_stock'
  | 'new_order'
  | 'payment_failed'
  | 'refund_requested'
  | 'new_ticket'
  | 'new_customer'
  | 'review_pending';

export interface AdminNotification {
  id: ID;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: ISODate;
}
