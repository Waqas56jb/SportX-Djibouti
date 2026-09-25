/**
 * Applies SQL migrations in supabase/migrations in filename order, exactly once each.
 * Works against a Supabase project (DATABASE_URL = project connection string) and plain PostgreSQL.
 * The same files can also be applied with the Supabase CLI (`supabase db push`).
 *
 *   npm run db:migrate           apply pending migrations
 *   npm run db:migrate -- --reset   drop and recreate the public schema first (NEVER in production)
 */
import '../src/config/bootEnv.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from scripts/ (tsx) and from dist/scripts/ (compiled).
const root = path.resolve(here, here.split(path.sep).includes('dist') ? '../..' : '..');
const MIGRATIONS = path.join(root, 'supabase', 'migrations');
const SHIM = path.join(root, 'supabase', 'local', 'supabase_shim.sql');

export async function migrate(connectionString: string, opts: { reset?: boolean; ssl?: boolean; log?: (m: string) => void } = {}) {
  const log = opts.log ?? ((m: string) => console.log(m));
  const client = new pg.Client({ connectionString, ssl: opts.ssl ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try {
    if (opts.reset) {
      if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset a production database.');
      log('Resetting public schema…');
      await client.query('drop schema if exists public cascade; create schema public; grant all on schema public to public;');
    }

    // Plain PostgreSQL (local/tests) lacks Supabase's auth schema and roles; add a minimal stand-in.
    const hasAuth = await client.query(`select 1 from pg_namespace where nspname = 'auth'`);
    if (hasAuth.rowCount === 0) {
      log('No Supabase auth schema found — applying local shim.');
      await client.query(fs.readFileSync(SHIM, 'utf8'));
    }

    await client.query(`create table if not exists public.schema_migrations (
      version text primary key, applied_at timestamptz not null default now())`);
    // Supabase exposes `public` through its Data API: keep this table invisible to anon/authenticated.
    await client.query(`alter table public.schema_migrations enable row level security`);
    const done = new Set((await client.query<{ version: string }>('select version from public.schema_migrations')).rows.map((r) => r.version));

    const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
    let applied = 0;
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('insert into public.schema_migrations (version) values ($1)', [file]);
        await client.query('COMMIT');
        applied++;
        log(`  ✓ ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
    log(applied ? `Applied ${applied} migration(s).` : 'Database is up to date.');
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const sslFlag = (process.env.DATABASE_SSL ?? '').toLowerCase();
  const ssl = sslFlag === 'true' || sslFlag === '1' || /supabase\.com|pooler\.supabase/i.test(url);
  migrate(url, { reset: process.argv.includes('--reset'), ssl }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
