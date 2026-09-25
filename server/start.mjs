/**
 * Production entry for Railway/Docker. This file is not compiled — if `dist/` is
 * missing, we still bind process.env.PORT on 0.0.0.0 so the proxy gets HTTP instead of a 502.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const parsedPort = Number(process.env.PORT);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4000;
const host = '0.0.0.0';

let handler;
let bootError;

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (handler) {
    handler(req, res);
    return;
  }
  const url = req.url?.split('?')[0] ?? '';
  if (url === '/health' || url === '/health/ready' || url === '/') {
    send(res, 200, {
      status: bootError ? 'error' : 'starting',
      port,
      cwd: process.cwd(),
      timestamp: new Date().toISOString(),
      error: bootError,
    });
    return;
  }
  send(res, 503, { success: false, error: { code: 'STARTING', message: bootError || 'Starting' } });
});

server.listen(port, host, () => {
  console.log(`SPORTX API listening on ${host}:${port} cwd=${process.cwd()} PORT=${process.env.PORT ?? '(unset)'}`);
});
server.on('error', (err) => {
  console.error('failed to bind HTTP server', err);
  process.exit(1);
});

function dist(...parts) {
  return pathToFileURL(path.join(here, 'dist', ...parts)).href;
}

const appFile = path.join(here, 'dist', 'src', 'app.js');
if (!fs.existsSync(appFile)) {
  bootError = `Built app not found at ${appFile}. Railway must run "npm run build" (tsc) before start. cwd=${process.cwd()}`;
  console.error(bootError);
} else {
  try {
    const { createApp } = await import(dist('src', 'app.js'));
    const { env } = await import(dist('src', 'config', 'env.js'));
    const { pool, warmPool } = await import(dist('src', 'config', 'database.js'));
    const { logger } = await import(dist('src', 'utils', 'logger.js'));
    const { jobs } = await import(dist('src', 'services', 'jobs.js'));
    const { registerScheduledJobs } = await import(dist('src', 'jobs', 'index.js'));

    handler = createApp();
    logger.info({ host, port, env: env.NODE_ENV, auth: env.AUTH_PROVIDER }, 'SPORTX API ready');

    void (async () => {
      try {
        const { migrate } = await import(dist('scripts', 'migrate.js'));
        const ssl = env.DATABASE_SSL || /supabase\.com|pooler\.supabase/i.test(env.DATABASE_URL);
        await migrate(env.DATABASE_URL, { ssl, log: (m) => logger.info(m) });
      } catch (err) {
        logger.error({ err }, 'startup migrations failed — API is up, schema may be incomplete');
      }
      void warmPool().catch((err) => logger.warn({ err }, 'database warm-up failed'));
      if (env.JOBS_ENABLED) registerScheduledJobs();
    })();

    const shutdown = async (signal) => {
      logger.info({ signal }, 'shutting down');
      server.close();
      jobs.stop();
      await jobs.drain();
      await pool.end();
      process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));
  } catch (err) {
    bootError = err instanceof Error ? err.message : String(err);
    console.error('Failed to load SPORTX API:\n', bootError);
  }
}
