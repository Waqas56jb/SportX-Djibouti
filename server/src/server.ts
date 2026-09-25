import http from 'node:http';
import './config/bootEnv.js';

/**
 * Bind the port before loading the rest of the app. Railway 502s when the process
 * crashes during env validation or module import — this way /health still answers.
 */
const parsedPort = Number(process.env.PORT);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4000;
const host = '0.0.0.0';

let handler: http.RequestListener | undefined;
let bootError: string | undefined;

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (handler) {
    handler(req, res);
    return;
  }
  const path = req.url?.split('?')[0] ?? '';
  if (path === '/health' || path === '/health/ready' || path === '/') {
    send(res, 200, { status: bootError ? 'error' : 'starting', timestamp: new Date().toISOString(), error: bootError });
    return;
  }
  send(res, 503, { success: false, error: { code: 'STARTING', message: bootError || 'Starting' } });
});

server.listen(port, host, () => {
  console.log(`SPORTX API listening on ${host}:${port}`);
});
server.on('error', (err) => {
  console.error('failed to bind HTTP server', err);
  process.exit(1);
});

try {
  const { createApp } = await import('./app.js');
  const { env } = await import('./config/env.js');
  const { pool, warmPool } = await import('./config/database.js');
  const { logger } = await import('./utils/logger.js');
  const { jobs } = await import('./services/jobs.js');
  const { registerScheduledJobs } = await import('./jobs/index.js');
  handler = createApp();
  logger.info({ host, port, env: env.NODE_ENV, auth: env.AUTH_PROVIDER, storage: env.STORAGE_PROVIDER, payments: env.PAYMENT_PROVIDERS }, 'SPORTX API ready');

  void (async () => {
    try {
      const { migrate } = await import('../scripts/migrate.js');
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
} catch (err) {
  bootError = err instanceof Error ? err.message : String(err);
  console.error('Failed to load SPORTX API:\n', bootError);
}
