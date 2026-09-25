export type TicketStatus = 'open' | 'in-progress' | 'waiting-customer' | 'resolved' | 'closed';

export type TicketCategory = 'order' | 'delivery' | 'returns' | 'payment' | 'product' | 'account' | 'other';

export interface TicketMessage {
  id: string;
  author: 'customer' | 'support';
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  number: string;
  subject: string;
  category: TicketCategory;
  orderId?: string | null;
  orderNumber?: string | null;
  status: TicketStatus;
  messageCount: number;
  lastMessage: { author: 'customer' | 'support'; preview: string; createdAt: string } | null;
  /** Present on the detail endpoint only. */
  messages: TicketMessage[];
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketInput {
  subject: string;
  category: TicketCategory;
  orderNumber?: string;
  message: string;
}
