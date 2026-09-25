import type { ListParams, Paginated, SupportTicket, TicketCategory, TicketMessage, TicketPriority, TicketStatus } from '@/types';
import { adminApi } from './api';
import { lower, opt, sortQuery } from './customerService';

interface TicketDto {
  id: string;
  number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  orderId: string | null;
  orderNumber: string | null;
  messageCount: number;
  lastMessage: { author: 'customer' | 'support'; preview: string; createdAt: string } | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  assignedToId: string | null;
  assignedToName: string | null;
}

interface MessageDto {
  id: string;
  ticketId: string;
  authorType: string;
  authorId: string | null;
  authorName: string;
  body: string;
  internal: boolean;
  createdAt: string;
}

interface TicketDetailDto extends TicketDto {
  messages: MessageDto[];
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    avatarUrl: string | null;
    status: string;
    deleted: boolean;
    ordersCount: number;
    totalSpent: number;
    joinedAt: string;
  } | null;
}

/** Server uses RETURNS; the admin UI (TICKET_CATEGORIES) uses 'return'. */
const toCategory = (c: string): TicketCategory => {
  const v = c.toLowerCase();
  return (v === 'returns' ? 'return' : v) as TicketCategory;
};

const toMessage = (m: MessageDto): TicketMessage => ({
  id: m.id,
  ticketId: m.ticketId,
  authorType: m.authorType === 'CUSTOMER' ? 'customer' : 'admin',
  authorName: m.authorName,
  body: m.body,
  internal: m.internal,
  createdAt: m.createdAt,
});

function toTicket(d: TicketDto): SupportTicket {
  return {
    id: d.id,
    number: d.number,
    subject: d.subject,
    customerId: d.customerId,
    customerName: d.customerName || d.customerEmail,
    customerEmail: d.customerEmail,
    orderId: opt(d.orderId),
    orderNumber: opt(d.orderNumber),
    category: toCategory(d.category),
    priority: lower<TicketPriority>(d.priority, 'normal'),
    status: lower<TicketStatus>(d.status, 'open'),
    assignedToId: opt(d.assignedToId),
    assignedToName: opt(d.assignedToName),
    messages: [],
    messageCount: d.messageCount ?? 0,
    lastMessage: d.lastMessage ? { author: d.lastMessage.author === 'customer' ? 'customer' : 'admin', preview: d.lastMessage.preview, createdAt: d.lastMessage.createdAt } : undefined,
    closedAt: opt(d.closedAt),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function toTicketDetail(d: TicketDetailDto): SupportTicket {
  const messages = (d.messages ?? []).map(toMessage);
  return {
    ...toTicket(d),
    messages,
    messageCount: messages.length,
    customer: d.customer ? { ...d.customer, avatarUrl: opt(d.customer.avatarUrl), status: d.customer.status.toLowerCase() } : undefined,
  };
}

export interface TicketFilters {
  status?: TicketStatus | '';
  priority?: TicketPriority | '';
  /** Staff user id or 'unassigned'. */
  assignedToId?: string;
  customerId?: string;
  category?: TicketCategory | '';
}

export interface TicketListParams extends ListParams {
  filters?: TicketFilters;
}

export type TicketCounts = Record<'all' | TicketStatus, number>;

export interface TicketPage extends Paginated<SupportTicket> {
  /** Per-status totals for the other filters (ignores the status filter). */
  counts: TicketCounts;
}

export type TicketPatch = { status?: TicketStatus; priority?: TicketPriority; assignedToId?: string | null };

export interface SupportAssignee {
  id: string;
  name: string;
  email: string;
  roleName: string;
}

/** Table column id → server sort key. */
const TICKET_SORT: Record<string, string> = { created: 'created_at', updated: 'updated_at', priority: 'priority', status: 'status' };

export const supportService = {
  /** GET /admin/support/tickets */
  async getTickets({ page = 1, pageSize = 25, search, sortBy, sortDir, filters = {} }: TicketListParams = {}): Promise<TicketPage> {
    const res = await adminApi.page<TicketDto, { counts?: Record<string, number> }>('/support/tickets', {
      page,
      limit: pageSize,
      search: search?.trim() || undefined,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      category: filters.category || undefined,
      assignedToId: filters.assignedToId || undefined,
      customerId: filters.customerId || undefined,
      ...sortQuery(TICKET_SORT, sortBy, sortDir),
    });
    const c = res.counts ?? {};
    return {
      data: res.data.map(toTicket),
      total: res.pagination.total,
      page: res.pagination.page,
      pageSize: res.pagination.limit,
      counts: { all: c.ALL ?? 0, open: c.OPEN ?? 0, in_progress: c.IN_PROGRESS ?? 0, waiting_customer: c.WAITING_CUSTOMER ?? 0, resolved: c.RESOLVED ?? 0, closed: c.CLOSED ?? 0 },
    };
  },

  /** GET /admin/support/tickets/:id — full thread incl. internal notes. */
  async getTicket(id: string): Promise<SupportTicket> {
    return toTicketDetail(await adminApi.get<TicketDetailDto>(`/support/tickets/${id}`));
  },

  /** POST /admin/support/tickets/:id/messages — `internal` notes are never shown or emailed to the customer. */
  async replyToTicket(id: string, body: string, internal = false): Promise<SupportTicket> {
    return toTicketDetail(await adminApi.post<TicketDetailDto>(`/support/tickets/${id}/messages`, { body: body.trim(), internal }));
  },

  /** PATCH /admin/support/tickets/:id/status (status only) or PATCH /admin/support/tickets/:id. */
  async updateTicket(id: string, patch: TicketPatch): Promise<SupportTicket> {
    const onlyStatus = patch.status && patch.priority === undefined && patch.assignedToId === undefined;
    if (onlyStatus) return toTicketDetail(await adminApi.patch<TicketDetailDto>(`/support/tickets/${id}/status`, { status: patch.status!.toUpperCase() }));
    const body: Record<string, unknown> = {};
    if (patch.status) body.status = patch.status.toUpperCase();
    if (patch.priority) body.priority = patch.priority.toUpperCase();
    if (patch.assignedToId !== undefined) body.assignedToId = patch.assignedToId || null;
    return toTicketDetail(await adminApi.patch<TicketDetailDto>(`/support/tickets/${id}`, body));
  },

  /** GET /admin/support/assignees — active staff with support access. */
  async getAssignees(): Promise<SupportAssignee[]> {
    const rows = await adminApi.get<{ id: string; name: string; email: string; roleName: string }[]>('/support/assignees');
    return rows.map((r) => ({ id: r.id, name: r.name || r.email, email: r.email, roleName: r.roleName }));
  },
};
