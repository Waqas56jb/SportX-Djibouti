import { defineConfig } from 'vitest/config';

export const TEST_DB_PORT = Number(process.env.TEST_DB_PORT ?? 54399);

export default defineConfig({
  test: {
    globalSetup: ['./tests/helpers/globalSetup.ts'],
    setupFiles: ['./tests/helpers/setupEach.ts'],
    // One embedded Postgres shared by all files → run files sequentially.
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: process.env.DBG ? 'error' : 'silent',
      DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${TEST_DB_PORT}/postgres`,
      DATABASE_POOL_MAX: '1',
      DATABASE_SSL: 'false',
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      CORS_EXTRA_ORIGINS: '',
      AUTH_PROVIDER: 'local',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
      STORAGE_PROVIDER: 'local',
      LOCAL_UPLOAD_DIR: 'tests/.uploads',
      PAYMENT_PROVIDERS: 'cash_on_delivery,mock',
      EMAIL_PROVIDER: 'console',
      COOKIE_SECURE: 'false',
      JOBS_ENABLED: 'false',
      FRONTEND_URL: 'http://localhost:5173',
      ADMIN_FRONTEND_URL: 'http://localhost:5174',
    },
  },
});
