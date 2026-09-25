export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed';

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
  userId: string;
  subject: string;
  category: TicketCategory;
  orderNumber?: string;
  status: TicketStatus;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketInput {
  subject: string;
  category: TicketCategory;
  orderNumber?: string;
  message: string;
}
