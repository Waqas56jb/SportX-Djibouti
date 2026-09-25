import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import path from 'node:path';
import { env, isProd } from './config/env.js';
import { checkDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import { requestId } from './middleware/requestId.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { generalLimiter } from './middleware/rateLimit.middleware.js';
import { apiRouter } from './routes/index.js';
import { paymentWebhookRouter } from './modules/payments/payments.webhook.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/health/ready' },
    }),
  );

  app.use(
    helmet({
      // JSON API: no inline content; keep the strict defaults.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const allowed = new Set([env.FRONTEND_URL, env.ADMIN_FRONTEND_URL, ...env.CORS_EXTRA_ORIGINS].map((o) => o.replace(/\/$/, '')));
  app.use(
    cors({
      origin: (origin, cb) => {
        // Non-browser clients (curl, server-to-server, webhooks) send no Origin.
        if (!origin || allowed.has(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  );

  // Webhooks need the raw body for signature verification — mounted before the JSON parser.
  app.use('/api/v1/payments/webhook', paymentWebhookRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Liveness must not wait on Postgres — Railway health checks fail if this blocks.
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });
  app.get('/health/ready', async (_req, res) => {
    const database = await checkDatabase();
    res.status(database ? 200 : 503).json({
      status: database ? 'ok' : 'degraded',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      checks: { database: database ? 'up' : 'down' },
    });
  });

  // Locally stored uploads (STORAGE_PROVIDER=local). Production uses Supabase Storage URLs.
  if (env.STORAGE_PROVIDER === 'local') {
    app.use('/uploads', express.static(path.resolve(env.LOCAL_UPLOAD_DIR), { fallthrough: false, dotfiles: 'deny', maxAge: isProd ? '7d' : 0 }));
  }

  app.use('/api/v1', generalLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
