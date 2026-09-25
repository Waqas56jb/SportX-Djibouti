import './bootEnv.js';
import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? def : v === 'true' || v === '1'));

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: z.string().default('0.0.0.0'),
    API_BASE_URL: z.string().url().default('http://localhost:4000'),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    ADMIN_FRONTEND_URL: z.string().url().default('http://localhost:5174'),
    CORS_EXTRA_ORIGINS: csv,
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    // Database: direct Postgres connection (Supabase → Project Settings → Database → connection string).
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: bool(false),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

    // Supabase (Auth + Storage). Required when AUTH_PROVIDER=supabase or STORAGE_PROVIDER=supabase.
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_JWT_SECRET: z.string().optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default('sportx-media'),

    // Authentication
    AUTH_PROVIDER: z.enum(['supabase', 'local']).default('supabase'),
    JWT_SECRET: z.string().optional(),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SECURE: bool(true),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    EMAIL_VERIFICATION_REQUIRED: bool(false),

    // Email
    EMAIL_PROVIDER: z.enum(['console', 'smtp', 'resend']).default('console'),
    EMAIL_FROM: z.string().default('SPORTX <no-reply@localhost>'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_SECURE: bool(false),
    RESEND_API_KEY: z.string().optional(),

    // Payments
    PAYMENT_PROVIDERS: csv, // e.g. "cash_on_delivery,stripe" — first card-capable provider handles CARD
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    MOCK_PAYMENT_WEBHOOK_SECRET: z.string().optional(),

    // Shipping
    SHIPPING_PROVIDER: z.enum(['internal']).default('internal'),

    // Storage
    STORAGE_PROVIDER: z.enum(['supabase', 'local']).default('supabase'),
    LOCAL_UPLOAD_DIR: z.string().default('uploads'),
    UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),

    // Background jobs (in-process scheduler; swap for a queue later).
    JOBS_ENABLED: bool(true),
  })
  .superRefine((e, ctx) => {
    const need = (key: keyof typeof e, why: string) => {
      if (!e[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required ${why}` });
    };
    if (e.AUTH_PROVIDER === 'supabase') {
      need('SUPABASE_URL', 'when AUTH_PROVIDER=supabase');
      need('SUPABASE_ANON_KEY', 'when AUTH_PROVIDER=supabase');
      need('SUPABASE_SERVICE_ROLE_KEY', 'when AUTH_PROVIDER=supabase');
    }
    // The API always issues its own short-lived access tokens, whichever credential provider is used.
    if (!e.JWT_SECRET || e.JWT_SECRET.length < 32) ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'JWT_SECRET (at least 32 random characters) is required' });
    if (e.COOKIE_SAMESITE === 'none' && !e.COOKIE_SECURE) ctx.addIssue({ code: 'custom', path: ['COOKIE_SAMESITE'], message: 'COOKIE_SAMESITE=none requires COOKIE_SECURE=true' });
    if (e.AUTH_PROVIDER === 'local') {
      if (e.NODE_ENV === 'production') ctx.addIssue({ code: 'custom', path: ['AUTH_PROVIDER'], message: 'AUTH_PROVIDER=local is for development and tests only' });
    }
    if (e.STORAGE_PROVIDER === 'supabase') {
      need('SUPABASE_URL', 'when STORAGE_PROVIDER=supabase');
      need('SUPABASE_SERVICE_ROLE_KEY', 'when STORAGE_PROVIDER=supabase');
    }
    if (e.PAYMENT_PROVIDERS.includes('stripe')) {
      need('STRIPE_SECRET_KEY', 'when stripe is enabled');
      need('STRIPE_WEBHOOK_SECRET', 'when stripe is enabled');
    }
    if (e.PAYMENT_PROVIDERS.includes('mock') && e.NODE_ENV === 'production') {
      ctx.addIssue({ code: 'custom', path: ['PAYMENT_PROVIDERS'], message: 'The mock payment provider cannot be enabled in production' });
    }
    if (e.EMAIL_PROVIDER === 'smtp') need('SMTP_HOST', 'when EMAIL_PROVIDER=smtp');
    if (e.EMAIL_PROVIDER === 'resend') need('RESEND_API_KEY', 'when EMAIL_PROVIDER=resend');
  });

export type Env = z.infer<typeof schema>;

function load(): Env {
  // Blank values (e.g. `SUPABASE_URL=` in .env) mean "not set".
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ''));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // Fail fast on boot; never print values (they may be secrets).
    throw new Error(`Invalid environment configuration:\n${lines}`);
  }
  const env = parsed.data;
  if (env.PAYMENT_PROVIDERS.length === 0) env.PAYMENT_PROVIDERS = ['cash_on_delivery'];
  return env;
}

export const env = load();
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
