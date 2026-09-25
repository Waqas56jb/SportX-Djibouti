import { logger } from '../utils/logger.js';
import { jobs } from '../services/jobs.js';
import { ordersService } from '../modules/orders/orders.service.js';
import { pool } from '../config/database.js';

/**
 * Recurring maintenance. Runs in-process; with several API instances, run it on one only
 * (JOBS_ENABLED=false elsewhere) or move to a queue/cron worker.
 */
export function registerScheduledJobs() {
  jobs.schedule('orders:expire-unpaid', 60_000, async () => {
    const n = await ordersService.expireUnpaidOrders();
    if (n) logger.info({ n }, 'expired unpaid orders');
  });
  // Campaign lifecycle follows its dates (paused / draft / archived campaigns are left alone).
  jobs.schedule('campaigns:lifecycle', 5 * 60_000, async () => {
    await pool.query(`update public.campaigns set status = 'ACTIVE' where status = 'SCHEDULED' and starts_at <= now() and ends_at > now()`);
    await pool.query(`update public.campaigns set status = 'ENDED' where status in ('SCHEDULED', 'ACTIVE') and ends_at <= now()`);
  });
  jobs.schedule('auth:prune-sessions', 6 * 3_600_000, async () => {
    await pool.query(`delete from public.auth_sessions where expires_at < now() - interval '7 days' or revoked_at < now() - interval '7 days'`);
    await pool.query(`delete from public.auth_tokens where expires_at < now() - interval '7 days'`);
  });
}
