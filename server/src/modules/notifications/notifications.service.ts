import { pool, query, queryOne, type Db } from '../../config/database.js';
import { notFound } from '../../utils/errors.js';
import { offsetOf, pageMeta } from '../../utils/pagination.js';
import { iso } from '../account/schema-helpers.js';

interface Row {
  id: string;
  audience: 'CUSTOMER' | 'ADMIN';
  type: string;
  title: string;
  message: string;
  link: string | null;
  data: Record<string, unknown>;
  read_at: Date | null;
  created_at: Date;
}

export function toNotification(n: Row) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    data: n.data ?? {},
    read: Boolean(n.read_at),
    readAt: iso(n.read_at),
    createdAt: iso(n.created_at)!,
  };
}

/**
 * Scope of a notification centre: a customer sees only their own CUSTOMER rows;
 * staff share the ADMIN centre (rows with user_id null).
 */
export type Scope = { kind: 'customer'; userId: string } | { kind: 'staff' };

function scopeSql(scope: Scope, params: unknown[]): string {
  if (scope.kind === 'staff') return `audience = 'ADMIN'`;
  params.push(scope.userId);
  return `audience = 'CUSTOMER' and user_id = $${params.length}`;
}

export const notificationsService = {
  async list(scope: Scope, opts: { page: number; limit: number; unread?: boolean; type?: string }) {
    const params: unknown[] = [];
    const where = [scopeSql(scope, params)];
    if (opts.unread === true) where.push('read_at is null');
    if (opts.unread === false) where.push('read_at is not null');
    if (opts.type) {
      params.push(opts.type);
      where.push(`type = $${params.length}::public.notification_type`);
    }
    const w = where.join(' and ');
    const [rows, total] = await Promise.all([
      query<Row>(`select * from public.notifications where ${w} order by created_at desc, id limit ${opts.limit} offset ${offsetOf(opts.page, opts.limit)}`, params),
      queryOne<{ n: number }>(`select count(*)::int as n from public.notifications where ${w}`, params),
    ]);
    return { rows: rows.map(toNotification), meta: pageMeta(opts.page, opts.limit, total?.n ?? 0), unreadCount: await this.unreadCount(scope) };
  },

  async unreadCount(scope: Scope, db: Db = pool) {
    const params: unknown[] = [];
    const r = await queryOne<{ n: number }>(`select count(*)::int as n from public.notifications where ${scopeSql(scope, params)} and read_at is null`, params, db);
    return r?.n ?? 0;
  },

  async recent(scope: Scope, limit = 5, db: Db = pool) {
    const params: unknown[] = [];
    const rows = await query<Row>(`select * from public.notifications where ${scopeSql(scope, params)} order by created_at desc, id limit ${limit}`, params, db);
    return rows.map(toNotification);
  },

  /** Marks one notification read/unread. Rows outside the caller's scope are 404. */
  async setRead(scope: Scope, id: string, read: boolean) {
    const params: unknown[] = [id];
    const row = await queryOne<Row>(
      `update public.notifications set read_at = ${read ? 'coalesce(read_at, now())' : 'null'} where id = $1 and ${scopeSql(scope, params)} returning *`,
      params,
    );
    if (!row) throw notFound('Notification');
    return { notification: toNotification(row), unreadCount: await this.unreadCount(scope) };
  },

  async setReadMany(scope: Scope, ids: string[], read: boolean) {
    const params: unknown[] = [ids];
    const rows = await query(`update public.notifications set read_at = ${read ? 'coalesce(read_at, now())' : 'null'} where id = any($1::uuid[]) and ${scopeSql(scope, params)} returning id`, params);
    return { updated: rows.length, unreadCount: await this.unreadCount(scope) };
  },

  async readAll(scope: Scope) {
    const params: unknown[] = [];
    const rows = await query(`update public.notifications set read_at = now() where ${scopeSql(scope, params)} and read_at is null returning id`, params);
    return { updated: rows.length, unreadCount: 0 };
  },

  async remove(scope: Scope, id: string) {
    const params: unknown[] = [id];
    const row = await queryOne(`delete from public.notifications where id = $1 and ${scopeSql(scope, params)} returning id`, params);
    if (!row) throw notFound('Notification');
    return { unreadCount: await this.unreadCount(scope) };
  },

  async removeMany(scope: Scope, ids: string[]) {
    const params: unknown[] = [ids];
    const rows = await query(`delete from public.notifications where id = any($1::uuid[]) and ${scopeSql(scope, params)} returning id`, params);
    return { deleted: rows.length, unreadCount: await this.unreadCount(scope) };
  },
};
