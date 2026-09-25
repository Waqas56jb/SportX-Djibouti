/**
 * One-command local stack without Docker or a Supabase project:
 *   embedded PostgreSQL (PGlite, persisted in ./.local-db) → migrations → seed → API (watch mode).
 *
 *   npm run dev:local
 *
 * Uses the local auth provider, local file storage and the cash-on-delivery + test payment providers.
 * Demo accounts are created only if SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (and optionally
 * SEED_DEMO_CUSTOMER_*) are set in .env. For the full Supabase stack use the Supabase CLI instead.
 */
import '../src/config/bootEnv.js';
import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { migrate } from './migrate.js';

const port = Number(process.env.LOCAL_DB_PORT ?? 54322);
const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;

const db = await PGlite.create({ dataDir: process.env.LOCAL_DB_DIR ?? './.local-db' });
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
await server.start();
console.log(`▸ Local PostgreSQL on ${url}`);

await migrate(url, { log: (m) => console.log(`  ${m}`) });

const env = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: url,
  DATABASE_SSL: 'false',
  DATABASE_POOL_MAX: '1',
  AUTH_PROVIDER: 'local',
  STORAGE_PROVIDER: 'local',
  PAYMENT_PROVIDERS: process.env.PAYMENT_PROVIDERS || 'cash_on_delivery,mock',
  COOKIE_SECURE: 'false',
  JWT_SECRET: process.env.JWT_SECRET || 'local-dev-only-secret-change-me-0123456789abcdef',
};

const run = (args: string[], wait: boolean) =>
  new Promise<number>((resolve) => {
    const child = spawn(process.execPath, ['--import', 'tsx', ...args], { env, stdio: 'inherit' });
    if (!wait) {
      const stop = async () => {
        child.kill('SIGTERM');
        await server.stop();
        await db.close();
        process.exit(0);
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
    }
    child.on('exit', (code) => resolve(code ?? 0));
  });

console.log('▸ Seeding…');
await run(['scripts/seed.ts'], true);
console.log('▸ Starting API…');
// No watch mode: the embedded database serves a single connection and an abrupt API restart leaves it
// unusable. Restart `npm run dev:local` after changing server code (data in ./.local-db is kept).
// For hot reload, use a real Postgres (Supabase CLI or Docker) with `npm run dev`.
await run(['src/server.ts'], false);
