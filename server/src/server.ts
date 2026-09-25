import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool, warmPool } from './config/database.js';
import { logger } from './utils/logger.js';
import { jobs } from './services/jobs.js';
import { registerScheduledJobs } from './jobs/index.js';
import { migrate } from '../scripts/migrate.js';

const app = createApp();
const bindHost = /^(0\.0\.0\.0|::|127\.0\.0\.1|localhost)$/i.test(env.HOST) ? env.HOST : '0.0.0.0';
const server = app.listen(env.PORT, bindHost, () => {
  logger.info({ host: bindHost, port: env.PORT, env: env.NODE_ENV, auth: env.AUTH_PROVIDER, storage: env.STORAGE_PROVIDER, payments: env.PAYMENT_PROVIDERS }, 'SPORTX API listening');
});
server.on('error', (err) => {
  logger.error({ err, host: bindHost, port: env.PORT }, 'failed to bind HTTP server');
  process.exit(1);
});

void (async () => {
  try {
    const ssl = env.DATABASE_SSL || /supabase\.com|pooler\.supabase/i.test(env.DATABASE_URL);
    await migrate(env.DATABASE_URL, { ssl, log: (m) => logger.info(m) });
  } catch (err) {
    logger.error({ err }, 'startup migrations failed — API is up, schema may be incomplete');
  }
  void warmPool().catch((err) => logger.warn({ err }, 'database warm-up failed'));
  if (env.JOBS_ENABLED) registerScheduledJobs();
})();

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close();
  jobs.stop();
  await jobs.drain();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));
