import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// int8 / numeric → JS number. Money is stored as integer DJF (well within Number.MAX_SAFE_INTEGER).
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  max: env.DATABASE_POOL_MAX,
  // Opening a TLS connection to a hosted pooler costs seconds; keep idle connections for 10 minutes.
  idleTimeoutMillis: 600_000,
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
});

pool.on('error', (err) => logger.error({ err }, 'postgres pool error'));

/** Anything that can run a query: the pool or a transaction client. */
export type Db = Pick<pg.PoolClient, 'query'>;

export async function query<T extends pg.QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  const res = await db.query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends pg.QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = [], db: Db = pool): Promise<T | null> {
  const res = await db.query<T>(text, params);
  return res.rows[0] ?? null;
}

/**
 * Runs `fn` inside a transaction. Rolls back on any thrown error so critical workflows
 * (order creation, stock adjustments, refunds) never leave partial writes behind.
 */
export async function withTransaction<T>(fn: (tx: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Opens a few connections at boot so the first requests don't pay the connection setup cost. */
export async function warmPool(n = Math.min(4, env.DATABASE_POOL_MAX)): Promise<void> {
  const clients = await Promise.allSettled(Array.from({ length: n }, () => pool.connect()));
  for (const c of clients) if (c.status === 'fulfilled') c.value.release();
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query('select 1');
    return true;
  } catch {
    return false;
  }
}
