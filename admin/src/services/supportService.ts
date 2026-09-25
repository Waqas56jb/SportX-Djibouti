import type { SupportTicket, TicketCategory, TicketPriority, TicketStatus } from '@/types';
import { appConfig } from '@/constants/config';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/constants/status';
import { uid } from '@/utils/id';
import { api, ApiError } from './http';
import { audit, db, delay, getActor, matches, NotFoundError, now } from './mock/db';

export interface TicketFilters {
  search?: string;
  status?: TicketStatus | '';
  priority?: TicketPriority | '';
  assignedToId?: string;
  customerId?: string;
  category?: TicketCategory | '';
}

export type TicketPatch = Partial<Pick<SupportTicket, 'status' | 'priority' | 'assignedToId'>>;

function find(id: string) {
  const t = db.tickets.find((x) => x.id === id || x.number === id);
  if (!t) throw new NotFoundError('Ticket');
  return t;
}

export const supportService = {
  /** GET /support/tickets */
  async getTickets(filters: TicketFilters = {}): Promise<SupportTicket[]> {
    if (!appConfig.useMocks) return api.get<SupportTicket[]>('/support/tickets', { ...filters });
    const list = db.tickets
      .filter((t) => matches([t.number, t.subject, t.customerName, t.customerEmail, t.orderNumber], filters.search))
      .filter((t) => !filters.status || t.status === filters.status)
      .filter((t) => !filters.priority || t.priority === filters.priority)
      .filter((t) => !filters.category || t.category === filters.category)
      .filter((t) => !filters.customerId || t.customerId === filters.customerId)
      .filter((t) => !filters.assignedToId || (filters.assignedToId === 'unassigned' ? !t.assignedToId : t.assignedToId === filters.assignedToId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return delay(list);
  },

  /** GET /support/tickets/:id */
  async getTicket(id: string): Promise<SupportTicket> {
    if (!appConfig.useMocks) return api.get<SupportTicket>(`/support/tickets/${id}`);
    return delay(find(id));
  },

  /** POST /support/tickets/:id/messages — `internal` notes are never emailed to the customer. */
  async replyToTicket(id: string, body: string, internal = false): Promise<SupportTicket> {
    if (!appConfig.useMocks) return api.post<SupportTicket>(`/support/tickets/${id}/messages`, { body, internal });
    if (!body.trim()) throw new ApiError('Message cannot be empty.', 400);
    const t = find(id);
    const actor = getActor();
    t.messages.push({ id: uid('msg'), ticketId: t.id, authorType: 'admin', authorName: actor.name, body: body.trim(), internal, createdAt: now() });
    if (!internal && (t.status === 'open' || t.status === 'in_progress')) t.status = 'waiting_customer';
    if (!t.assignedToId && actor.id !== 'system') {
      t.assignedToId = actor.id;
      t.assignedToName = actor.name;
    }
    t.updatedAt = now();
    audit(internal ? 'Internal note added' : 'Ticket replied', 'Support', t.number, `/support/${t.id}`);
    return delay(t, 450);
  },

  /** PATCH /support/tickets/:id */
  async updateTicket(id: string, patch: TicketPatch): Promise<SupportTicket> {
    if (!appConfig.useMocks) return api.patch<SupportTicket>(`/support/tickets/${id}`, patch);
    const t = find(id);
    const changes: string[] = [];
    if (patch.status && patch.status !== t.status) {
      t.status = patch.status;
      changes.push(`status → ${TICKET_STATUS[patch.status].label}`);
    }
    if (patch.priority && patch.priority !== t.priority) {
      t.priority = patch.priority;
      changes.push(`priority → ${TICKET_PRIORITY[patch.priority].label}`);
    }
    if (patch.assignedToId !== undefined && patch.assignedToId !== t.assignedToId) {
      const admin = db.adminUsers.find((a) => a.id === patch.assignedToId);
      t.assignedToId = admin?.id;
      t.assignedToName = admin?.name;
      changes.push(admin ? `assigned to ${admin.name}` : 'unassigned');
    }
    t.updatedAt = now();
    if (changes.length) audit('Ticket updated', 'Support', `${t.number}: ${changes.join(', ')}`, `/support/${t.id}`);
    return delay(t, 250);
  },

  /** GET /support/assignees — active admins with support access. */
  async getAssignees(): Promise<{ id: string; name: string; roleName: string }[]> {
    if (!appConfig.useMocks) return api.get('/support/assignees');
    const roleIds = db.roles.filter((r) => r.permissions.includes('support:edit')).map((r) => r.id);
    return delay(db.adminUsers.filter((a) => a.status === 'active' && roleIds.includes(a.roleId)).map((a) => ({ id: a.id, name: a.name, roleName: a.roleName })), 150);
  },
};
