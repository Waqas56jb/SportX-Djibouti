/**
 * Local development database without Docker: an embedded PostgreSQL (PGlite) exposed on a TCP port,
 * persisted to ./.local-db. Point DATABASE_URL at it:
 *
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres
 *
 * For a full local Supabase stack (Auth, Storage, Studio) use the Supabase CLI instead (`supabase start`).
 * PGlite serves one connection at a time, so run the API with DATABASE_POOL_MAX=1 against it.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const port = Number(process.env.LOCAL_DB_PORT ?? 54322);
const db = await PGlite.create({ dataDir: './.local-db' });
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
await server.start();
console.log(`Local PostgreSQL (PGlite) listening on postgres://postgres:postgres@127.0.0.1:${port}/postgres`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
