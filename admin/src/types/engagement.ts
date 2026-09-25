import type { ID, ISODate } from './common';
import type { ProductType } from './catalog';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

export interface Review {
  id: ID;
  productId: ID;
  productName: string;
  productType: ProductType;
  customerId: ID;
  customerName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: ISODate;
  moderatedAt?: ISODate;
  moderatedBy?: string;
}

export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'order' | 'delivery' | 'return' | 'product' | 'payment' | 'account' | 'other';

export interface TicketMessage {
  id: ID;
  ticketId: ID;
  authorType: 'customer' | 'admin';
  authorName: string;
  body: string;
  /** Internal notes are visible to staff only and never sent to the customer. */
  internal: boolean;
  createdAt: ISODate;
}

export interface SupportTicket {
  id: ID;
  number: string;
  subject: string;
  customerId: ID;
  customerName: string;
  customerEmail: string;
  orderNumber?: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedToId?: ID;
  assignedToName?: string;
  messages: TicketMessage[];
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
