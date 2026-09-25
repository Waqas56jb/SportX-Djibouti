import type { SupportTicket, TicketCategory, TicketInput, TicketMessage, TicketStatus } from '@/types';
import { ApiError, api, requestPage } from './api';

type ApiTicket = Omit<SupportTicket, 'status' | 'category' | 'messages'> & {
  status: string;
  category: string;
  messages?: TicketMessage[];
};

const STATUS: Record<string, TicketStatus> = {
  OPEN: 'open',
  IN_PROGRESS: 'in-progress',
  WAITING_CUSTOMER: 'waiting-customer',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

const CATEGORIES: TicketCategory[] = ['order', 'delivery', 'returns', 'payment', 'product', 'account', 'other'];

const toTicket = (t: ApiTicket): SupportTicket => {
  const category = t.category.toLowerCase() as TicketCategory;
  return {
    ...t,
    status: STATUS[t.status] ?? 'open',
    category: CATEGORIES.includes(category) ? category : 'other',
    messages: t.messages ?? [],
    messageCount: t.messageCount ?? t.messages?.length ?? 0,
  };
};

/** The signed-in customer's support tickets (`/support/tickets`). */
export const supportService = {
  async list(_userId?: string, opts: { page?: number; limit?: number; status?: TicketStatus } = {}): Promise<SupportTicket[]> {
    const res = await requestPage<ApiTicket>('/support/tickets', {
      query: { page: opts.page ?? 1, limit: opts.limit ?? 50, status: opts.status },
    });
    return res.data.map(toTicket);
  },

  /** Resolves null when the ticket does not exist (or is not the customer's). */
  async get(_userId: string | undefined, id: string): Promise<SupportTicket | null> {
    try {
      return toTicket(await api.get<ApiTicket>(`/support/tickets/${id}`));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.code === 'VALIDATION_ERROR')) return null;
      throw err;
    }
  },

  async create(_user: unknown, input: TicketInput): Promise<SupportTicket> {
    const ticket = await api.post<ApiTicket>('/support/tickets', {
      subject: input.subject.trim(),
      category: input.category.toUpperCase(),
      orderNumber: input.orderNumber || null,
      message: input.message.trim(),
    });
    return toTicket(ticket);
  },

  /** Replying to a resolved ticket reopens it; closed tickets reject replies. */
  async reply(_user: unknown, ticketId: string, body: string): Promise<SupportTicket> {
    return toTicket(await api.post<ApiTicket>(`/support/tickets/${ticketId}/messages`, { body: body.trim() }));
  },
};
