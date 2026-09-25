import { pool, query, type Db } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import type { NotificationType } from '../../types/common.js';

interface NotifyInput {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  data?: Record<string, unknown>;
}

/**
 * Database-backed notifications. Stored rows power the in-app notification centres;
 * email/SMS/push delivery can be attached here later without changing business code.
 * Failures are logged and never break the calling workflow.
 */
export const notificationService = {
  /** Notify a customer. Pass the transaction client to write atomically with the triggering change. */
  async toUser(userId: string, input: NotifyInput, db: Db = pool): Promise<void> {
    try {
      await query(
        `insert into public.notifications (audience, user_id, type, title, message, link, data) values ('CUSTOMER', $1, $2, $3, $4, $5, $6)`,
        [userId, input.type, input.title, input.message, input.link ?? null, JSON.stringify(input.data ?? {})],
        db,
      );
    } catch (err) {
      if (db !== pool) throw err; // inside a transaction the caller decides
      logger.warn({ err, type: input.type }, 'customer notification failed');
    }
  },

  /** Notify the staff notification centre (shared across admins). */
  async toStaff(input: NotifyInput, db: Db = pool): Promise<void> {
    try {
      await query(
        `insert into public.notifications (audience, user_id, type, title, message, link, data) values ('ADMIN', null, $1, $2, $3, $4, $5)`,
        [input.type, input.title, input.message, input.link ?? null, JSON.stringify(input.data ?? {})],
        db,
      );
    } catch (err) {
      if (db !== pool) throw err;
      logger.warn({ err, type: input.type }, 'staff notification failed');
    }
  },
};
