import type { Request } from 'express';
import type { PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { pool, query, queryOne, withTransaction, type Db } from '../../config/database.js';
import { AppError, conflict, notFound } from '../../utils/errors.js';
import { nextTicketNumber } from '../../utils/orderNumber.js';
import { dateBounds, offsetOf, pageMeta } from '../../utils/pagination.js';
import { audit } from '../../services/audit.service.js';
import { emailService } from '../../services/email/email.service.js';
import { notificationService } from '../../services/notification/notification.service.js';
import { toOrderSummary, type OrderRow } from '../orders/orders.mapper.js';
import { iso } from '../account/schema-helpers.js';
import type { TicketPriority, TicketStatus } from '../../types/common.js';
import type { AdminListTicketsQuery, CustomerListQuery } from './support.schema.js';

interface TicketRow {
  id: string;
  ticket_number: string;
  user_id: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  order_id: string | null;
  assigned_to: string | null;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  order_number: string | null;
  assignee_name: string | null;
  message_count: number;
  last_message_at: Date | null;
  last_message_body: string | null;
  last_message_author: string | null;
}

interface MessageRow {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_type: 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  body: string;
  is_internal: boolean;
  created_at: Date;
  first_name: string | null;
  last_name: string | null;
}

/** `internal` controls whether internal notes are counted/previewed (staff) or excluded (customer). */
const ticketSelect = (internal: boolean) => `
  select t.*, u.first_name as customer_first_name, u.last_name as customer_last_name, u.email as customer_email,
         o.order_number, nullif(trim(a.first_name || ' ' || a.last_name), '') as assignee_name,
         (select count(*)::int from public.support_messages m where m.ticket_id = t.id ${internal ? '' : 'and not m.is_internal'}) as message_count,
         lm.created_at as last_message_at, lm.body as last_message_body, lm.author_type as last_message_author
    from public.support_tickets t
    join public.users u on u.id = t.user_id
    left join public.orders o on o.id = t.order_id
    left join public.users a on a.id = t.assigned_to
    left join lateral (select m.created_at, m.body, m.author_type from public.support_messages m
                        where m.ticket_id = t.id ${internal ? '' : 'and not m.is_internal'} order by m.created_at desc, m.id desc limit 1) lm on true`;

const preview = (s: string | null) => (s ? (s.length > 140 ? `${s.slice(0, 137)}…` : s) : null);

function baseTicket(t: TicketRow) {
  return {
    id: t.id,
    number: t.ticket_number,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    orderId: t.order_id,
    orderNumber: t.order_number,
    messageCount: t.message_count,
    lastMessage: t.last_message_at ? { author: t.last_message_author === 'CUSTOMER' ? 'customer' : 'support', preview: preview(t.last_message_body), createdAt: iso(t.last_message_at)! } : null,
    closedAt: iso(t.closed_at),
    createdAt: iso(t.created_at)!,
    updatedAt: iso(t.updated_at)!,
  };
}

function toCustomerTicket(t: TicketRow) {
  return baseTicket(t);
}

function toAdminTicket(t: TicketRow) {
  return {
    ...baseTicket(t),
    customerId: t.user_id,
    customerName: `${t.customer_first_name} ${t.customer_last_name}`.trim(),
    customerEmail: t.customer_email,
    assignedToId: t.assigned_to,
    assignedToName: t.assignee_name,
  };
}

async function messages(ticketId: string, includeInternal: boolean, db: Db = pool) {
  return query<MessageRow>(
    `select m.*, u.first_name, u.last_name from public.support_messages m left join public.users u on u.id = m.author_id
      where m.ticket_id = $1 ${includeInternal ? '' : 'and not m.is_internal'} order by m.created_at, m.id`,
    [ticketId],
    db,
  );
}

async function loadTicket(where: string, params: unknown[], internal: boolean, db: Db = pool) {
  return queryOne<TicketRow>(`${ticketSelect(internal)} where ${where}`, params, db);
}

function lockTicket(tx: PoolClient, id: string) {
  return queryOne<{ id: string; ticket_number: string; user_id: string; subject: string; status: TicketStatus; priority: TicketPriority; assigned_to: string | null }>(
    `select id, ticket_number, user_id, subject, status, priority, assigned_to from public.support_tickets where id = $1 for update`,
    [id],
    tx,
  );
}

const ticketLink = (id: string) => `${env.FRONTEND_URL.replace(/\/$/, '')}/account/support/${id}`;

export const supportService = {
  // ─── Customer ─────────────────────────────────────────────────────────────
  async listForCustomer(userId: string, q: CustomerListQuery) {
    const params: unknown[] = [userId];
    let where = 't.user_id = $1';
    if (q.status) {
      params.push(q.status);
      where += ` and t.status = $2::public.ticket_status`;
    }
    const [rows, total] = await Promise.all([
      query<TicketRow>(`${ticketSelect(false)} where ${where} order by t.updated_at desc, t.id limit ${q.limit} offset ${offsetOf(q.page, q.limit)}`, params),
      queryOne<{ n: number }>(`select count(*)::int as n from public.support_tickets t where ${where}`, params),
    ]);
    return { rows: rows.map(toCustomerTicket), meta: pageMeta(q.page, q.limit, total?.n ?? 0) };
  },

  /** Customer view: never includes internal notes, staff ids or assignment. */
  async getForCustomer(userId: string, id: string) {
    const t = await loadTicket('t.id = $1 and t.user_id = $2', [id, userId], false);
    if (!t) throw notFound('Ticket');
    const msgs = await messages(id, false);
    return {
      ...toCustomerTicket(t),
      messages: msgs.map((m) => ({
        id: m.id,
        author: m.author_type === 'CUSTOMER' ? ('customer' as const) : ('support' as const),
        authorName: m.author_type === 'CUSTOMER' ? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || 'You' : m.first_name ? `${m.first_name} · SPORTX Support` : 'SPORTX Support',
        body: m.body,
        createdAt: iso(m.created_at)!,
      })),
    };
  },

  async create(userId: string, input: { subject: string; category: string; orderNumber: string | null; message: string }) {
    const id = await withTransaction(async (tx) => {
      let orderId: string | null = null;
      if (input.orderNumber) {
        // Link only the customer's own order; any other order number is reported as not found.
        const o = await queryOne<{ id: string }>(`select id from public.orders where upper(order_number) = $1 and user_id = $2 and deleted_at is null`, [input.orderNumber, userId], tx);
        if (!o) throw new AppError('VALIDATION_ERROR', 'We could not find that order on your account.', { fieldErrors: { orderNumber: ['Order not found.'] } });
        orderId = o.id;
      }
      const number = await nextTicketNumber(tx);
      const t = await queryOne<{ id: string }>(
        `insert into public.support_tickets (ticket_number, user_id, subject, category, order_id) values ($1, $2, $3, $4::public.ticket_category, $5) returning id`,
        [number, userId, input.subject, input.category, orderId],
        tx,
      );
      await query(`insert into public.support_messages (ticket_id, author_id, author_type, body) values ($1, $2, 'CUSTOMER', $3)`, [t!.id, userId, input.message], tx);
      await notificationService.toStaff({ type: 'NEW_TICKET', title: `New support ticket ${number}`, message: input.subject, link: `/support/${t!.id}`, data: { ticketId: t!.id, ticketNumber: number } }, tx);
      return t!.id;
    });
    return this.getForCustomer(userId, id);
  },

  /** Customer reply: closed tickets are read-only; resolved / waiting tickets go back to OPEN. */
  async customerReply(userId: string, id: string, body: string) {
    await withTransaction(async (tx) => {
      const t = await lockTicket(tx, id);
      if (!t || t.user_id !== userId) throw notFound('Ticket');
      if (t.status === 'CLOSED') throw conflict('This ticket is closed and can no longer receive replies. Please open a new request.');
      await query(`insert into public.support_messages (ticket_id, author_id, author_type, body) values ($1, $2, 'CUSTOMER', $3)`, [id, userId, body], tx);
      const reopen = t.status === 'RESOLVED' || t.status === 'WAITING_CUSTOMER';
      await query(`update public.support_tickets set status = case when $2 then 'OPEN'::public.ticket_status else status end, closed_at = null where id = $1`, [id, reopen], tx);
      await notificationService.toStaff({ type: 'NEW_TICKET', title: `Customer replied on ${t.ticket_number}`, message: t.subject, link: `/support/${id}`, data: { ticketId: id, ticketNumber: t.ticket_number, reply: true } }, tx);
    });
    return this.getForCustomer(userId, id);
  },

  // ─── Admin ────────────────────────────────────────────────────────────────
  async adminList(q: AdminListTicketsQuery) {
    const where: string[] = ['true'];
    const params: unknown[] = [];
    const add = (sql: (n: string) => string, value: unknown) => {
      params.push(value);
      where.push(sql(`$${params.length}`));
    };
    if (q.priority) add((n) => `t.priority = ${n}::public.ticket_priority`, q.priority);
    if (q.category) add((n) => `t.category = ${n}::public.ticket_category`, q.category);
    if (q.customerId) add((n) => `t.user_id = ${n}::uuid`, q.customerId);
    const assignee = q.assignedToId ?? q.assignee;
    if (assignee === 'unassigned') where.push('t.assigned_to is null');
    else if (assignee) add((n) => `t.assigned_to = ${n}::uuid`, assignee);
    if (q.search)
      add(
        (n) => `(t.ticket_number ilike ${n} or t.subject ilike ${n} or (u.first_name || ' ' || u.last_name) ilike ${n} or u.email ilike ${n} or o.order_number ilike ${n})`,
        `%${q.search.replace(/[%_\\]/g, '\\$&')}%`,
      );
    const { from, to } = dateBounds(q.date_from, q.date_to);
    if (from) add((n) => `t.created_at >= ${n}::timestamptz`, from);
    if (to) add((n) => `t.created_at <= ${n}::timestamptz`, to);

    const baseWhere = where.join(' and ');
    const baseParams = [...params];
    if (q.status) add((n) => `t.status = ${n}::public.ticket_status`, q.status);
    const w = where.join(' and ');
    const joins = `from public.support_tickets t join public.users u on u.id = t.user_id left join public.orders o on o.id = t.order_id`;
    const sort =
      q.sort === 'priority'
        ? `array_position(array['URGENT','HIGH','NORMAL','LOW']::public.ticket_priority[], t.priority) ${q.order === 'asc' ? 'desc' : 'asc'}, t.updated_at desc`
        : `t.${q.sort ?? 'updated_at'} ${q.order === 'asc' ? 'asc' : 'desc'}`;

    const [rows, total, counts] = await Promise.all([
      query<TicketRow>(`${ticketSelect(true)} where ${w} order by ${sort}, t.id limit ${q.limit} offset ${offsetOf(q.page, q.limit)}`, params),
      queryOne<{ n: number }>(`select count(*)::int as n ${joins} where ${w}`, params),
      query<{ status: TicketStatus; n: number }>(`select t.status, count(*)::int as n ${joins} where ${baseWhere} group by t.status`, baseParams),
    ]);
    const statusCounts: Record<TicketStatus | 'ALL', number> = { ALL: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_CUSTOMER: 0, RESOLVED: 0, CLOSED: 0 };
    for (const c of counts) {
      statusCounts[c.status] = c.n;
      statusCounts.ALL += c.n;
    }
    return { rows: rows.map(toAdminTicket), meta: pageMeta(q.page, q.limit, total?.n ?? 0), counts: statusCounts };
  },

  /** Staff view: every message (internal notes included), customer summary and recent orders. */
  async adminGet(id: string) {
    const t = await loadTicket('t.id = $1', [id], true);
    if (!t) throw notFound('Ticket');
    const [msgs, customer, orders] = await Promise.all([
      messages(id, true),
      queryOne<{ id: string; first_name: string; last_name: string; email: string; phone: string | null; avatar_url: string | null; status: string; created_at: Date; deleted_at: Date | null; orders_count: number; total_spent: number }>(
        `select u.id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.status, u.created_at, u.deleted_at,
                (select count(*)::int from public.orders o where o.user_id = u.id and o.deleted_at is null) as orders_count,
                (select coalesce(sum(o.grand_total - o.refunded_total), 0) from public.orders o where o.user_id = u.id and o.payment_status in ('PAID', 'PARTIALLY_REFUNDED')) as total_spent
           from public.users u where u.id = $1`,
        [t.user_id],
      ),
      query<OrderRow & { first_item_image: string | null }>(
        `select o.*, (select image_url from public.order_items i where i.order_id = o.id order by i.created_at limit 1) as first_item_image
           from public.orders o where o.user_id = $1 and o.deleted_at is null order by o.placed_at desc limit 5`,
        [t.user_id],
      ),
    ]);
    return {
      ...toAdminTicket(t),
      messages: msgs.map((m) => ({
        id: m.id,
        ticketId: m.ticket_id,
        authorType: m.author_type,
        authorId: m.author_id,
        authorName: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || (m.author_type === 'SYSTEM' ? 'System' : 'Unknown'),
        body: m.body,
        internal: m.is_internal,
        createdAt: iso(m.created_at)!,
      })),
      customer: customer
        ? {
            id: customer.id,
            firstName: customer.first_name,
            lastName: customer.last_name,
            email: customer.email,
            phone: customer.phone ?? '',
            avatarUrl: customer.avatar_url,
            status: customer.status,
            deleted: Boolean(customer.deleted_at),
            ordersCount: customer.orders_count,
            totalSpent: customer.total_spent,
            joinedAt: iso(customer.created_at)!,
          }
        : null,
      recentOrders: orders.map(toOrderSummary),
    };
  },

  async assignees() {
    const rows = await query<{ id: string; first_name: string; last_name: string; email: string; role_name: string }>(
      `select u.id, u.first_name, u.last_name, u.email, min(r.name) as role_name
         from public.users u
         join public.user_roles ur on ur.user_id = u.id
         join public.roles r on r.id = ur.role_id and r.is_staff
         join public.role_permissions rp on rp.role_id = r.id and rp.permission_key = 'support:view'
        where u.status = 'ACTIVE' and u.deleted_at is null
        group by u.id order by u.first_name, u.last_name`,
    );
    return rows.map((r) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`.trim(), firstName: r.first_name, lastName: r.last_name, email: r.email, roleName: r.role_name }));
  },

  async update(req: Request, id: string, patch: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: string | null }) {
    await withTransaction(async (tx) => {
      const t = await lockTicket(tx, id);
      if (!t) throw notFound('Ticket');
      const changes: Record<string, { from: unknown; to: unknown }> = {};

      if (patch.assignedToId !== undefined && patch.assignedToId !== t.assigned_to) {
        if (patch.assignedToId) {
          const ok = await queryOne(
            `select 1 from public.users u join public.user_roles ur on ur.user_id = u.id join public.roles r on r.id = ur.role_id and r.is_staff
               join public.role_permissions rp on rp.role_id = r.id and rp.permission_key = 'support:view'
              where u.id = $1 and u.status = 'ACTIVE' and u.deleted_at is null limit 1`,
            [patch.assignedToId],
            tx,
          );
          if (!ok) throw new AppError('VALIDATION_ERROR', 'The assignee must be an active staff member with support access.', { fieldErrors: { assignedToId: ['Invalid assignee.'] } });
        }
        await query(`update public.support_tickets set assigned_to = $2 where id = $1`, [id, patch.assignedToId], tx);
        changes.assignedToId = { from: t.assigned_to, to: patch.assignedToId };
      }
      if (patch.priority && patch.priority !== t.priority) {
        await query(`update public.support_tickets set priority = $2::public.ticket_priority where id = $1`, [id, patch.priority], tx);
        changes.priority = { from: t.priority, to: patch.priority };
      }
      if (patch.status && patch.status !== t.status) {
        await query(
          `update public.support_tickets set status = $2::public.ticket_status, closed_at = case when $2::public.ticket_status = 'CLOSED' then now() else null end where id = $1`,
          [id, patch.status],
          tx,
        );
        changes.status = { from: t.status, to: patch.status };
      }
      if (Object.keys(changes).length) {
        const action = changes.status && Object.keys(changes).length === 1 ? 'Ticket status changed' : changes.assignedToId && Object.keys(changes).length === 1 ? (patch.assignedToId ? 'Ticket assigned' : 'Ticket unassigned') : 'Ticket updated';
        await audit(req, { action, entityType: 'support_ticket', entityId: id, metadata: { ticketNumber: t.ticket_number, changes } }, tx);
      }
    });
    return this.adminGet(id);
  },

  /**
   * Staff reply. Public replies notify the customer (in-app, and email after commit) and move an
   * OPEN / IN_PROGRESS ticket to WAITING_CUSTOMER. Internal notes never reach the customer.
   */
  async adminReply(req: Request, id: string, body: string, internal: boolean) {
    const staffId = req.auth!.userId;
    const email = await withTransaction(async (tx) => {
      const t = await lockTicket(tx, id);
      if (!t) throw notFound('Ticket');
      if (!internal && t.status === 'CLOSED') throw conflict('This ticket is closed. Reopen it before replying to the customer.');
      await query(`insert into public.support_messages (ticket_id, author_id, author_type, body, is_internal) values ($1, $2, 'ADMIN', $3, $4)`, [id, staffId, body, internal], tx);
      const waiting = !internal && (t.status === 'OPEN' || t.status === 'IN_PROGRESS');
      await query(
        `update public.support_tickets set
           status = case when $2 then 'WAITING_CUSTOMER'::public.ticket_status else status end,
           assigned_to = coalesce(assigned_to, $3)
         where id = $1`,
        [id, waiting, staffId],
        tx,
      );
      await audit(req, { action: internal ? 'Internal note added' : 'Ticket replied', entityType: 'support_ticket', entityId: id, metadata: { ticketNumber: t.ticket_number, autoAssigned: !t.assigned_to } }, tx);
      if (internal) return null;
      await notificationService.toUser(
        t.user_id,
        { type: 'SUPPORT_REPLY', title: `New reply on ${t.ticket_number}`, message: `SPORTX Support replied to "${t.subject}".`, link: `/account/support/${id}`, data: { ticketId: id, ticketNumber: t.ticket_number } },
        tx,
      );
      const customer = await queryOne<{ email: string; deleted_at: Date | null }>(`select email, deleted_at from public.users where id = $1`, [t.user_id], tx);
      return customer && !customer.deleted_at ? { to: customer.email, ticketNumber: t.ticket_number, subject: t.subject } : null;
    });
    if (email) emailService.queue('support_reply', email.to, { ticketNumber: email.ticketNumber, subject: email.subject, link: ticketLink(id) });
    return this.adminGet(id);
  },

  async openCount(userId: string, db: Db = pool) {
    const r = await queryOne<{ n: number }>(`select count(*)::int as n from public.support_tickets where user_id = $1 and status not in ('RESOLVED', 'CLOSED')`, [userId], db);
    return r?.n ?? 0;
  },
};
