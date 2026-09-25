import type { SupportTicket, TicketInput, User } from '@/types';
import { uid } from '@/utils/id';
import { apiClient } from './api/client';
import { USE_MOCK_API } from './config';
import { MockError, db, delay } from './mock/db';

export const supportService = {
  async list(userId: string): Promise<SupportTicket[]> {
    if (!USE_MOCK_API) return apiClient.get<SupportTicket[]>('/me/tickets');
    await delay(300, 550);
    return db
      .read()
      .tickets.filter((t) => t.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(userId: string, id: string): Promise<SupportTicket | null> {
    if (!USE_MOCK_API) return apiClient.get<SupportTicket | null>(`/me/tickets/${id}`);
    await delay(250, 450);
    return db.read().tickets.find((t) => t.id === id && t.userId === userId) ?? null;
  },

  async create(user: User, input: TicketInput): Promise<SupportTicket> {
    if (!USE_MOCK_API) return apiClient.post<SupportTicket>('/me/tickets', input);
    await delay(500, 800);
    const now = new Date().toISOString();
    const count = db.read().tickets.length;
    const ticket: SupportTicket = {
      id: uid('tkt'),
      number: `TCK-${1100 + count}`,
      userId: user.id,
      subject: input.subject.trim(),
      category: input.category,
      orderNumber: input.orderNumber || undefined,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      messages: [{ id: uid('msg'), author: 'customer', authorName: `${user.firstName} ${user.lastName}`, body: input.message.trim(), createdAt: now }],
    };
    db.write((d) => {
      d.tickets.unshift(ticket);
    });
    return ticket;
  },

  async reply(user: User, ticketId: string, body: string): Promise<SupportTicket> {
    if (!USE_MOCK_API) return apiClient.post<SupportTicket>(`/me/tickets/${ticketId}/messages`, { body });
    await delay(400, 700);
    let updated: SupportTicket | undefined;
    db.write((d) => {
      const t = d.tickets.find((x) => x.id === ticketId && x.userId === user.id);
      if (!t || t.status === 'closed') return;
      const now = new Date().toISOString();
      t.messages.push({ id: uid('msg'), author: 'customer', authorName: `${user.firstName} ${user.lastName}`, body: body.trim(), createdAt: now });
      t.updatedAt = now;
      // A customer reply re-opens a resolved ticket for the support team.
      if (t.status === 'resolved') t.status = 'open';
      updated = t;
    });
    if (!updated) throw new MockError('This ticket is closed and can no longer receive replies.', 409);
    return updated;
  },
};
