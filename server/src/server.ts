import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool, warmPool } from './config/database.js';
import { logger } from './utils/logger.js';
import { jobs } from './services/jobs.js';
import { registerScheduledJobs } from './jobs/index.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV, auth: env.AUTH_PROVIDER, storage: env.STORAGE_PROVIDER, payments: env.PAYMENT_PROVIDERS }, 'SPORTX API listening');
});

void warmPool().catch((err) => logger.warn({ err }, 'database warm-up failed'));
if (env.JOBS_ENABLED) registerScheduledJobs();

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
