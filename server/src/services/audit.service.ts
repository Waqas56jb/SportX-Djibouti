import type { Request } from 'express';
import { pool, query, type Db } from '../config/database.js';
import { logger } from '../utils/logger.js';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  status?: 'SUCCESS' | 'FAILED';
  adminId?: string | null;
}

/**
 * Writes to admin_activity_logs. Pass the transaction client so the audit row commits
 * (or rolls back) together with the change it describes.
 */
export async function audit(req: Request | null, entry: AuditEntry, db: Db = pool): Promise<void> {
  const params = [
    entry.adminId ?? req?.auth?.userId ?? null,
    entry.action,
    entry.entityType,
    entry.entityId ?? null,
    JSON.stringify(entry.metadata ?? {}),
    entry.status ?? 'SUCCESS',
    req?.ip ?? null,
    req?.header('user-agent')?.slice(0, 300) ?? null,
  ];
  const sql = `insert into public.admin_activity_logs (admin_id, action, entity_type, entity_id, metadata, status, ip_address, user_agent)
               values ($1, $2, $3, $4, $5, $6, $7, $8)`;
  if (db !== pool) {
    await query(sql, params, db);
    return;
  }
  try {
    await query(sql, params);
  } catch (err) {
    logger.warn({ err, action: entry.action }, 'audit log write failed');
  }
}
