import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { migrate } from '../../scripts/migrate.js';
import { TEST_DB_PORT } from '../../vitest.config.js';

/** Starts one in-memory PostgreSQL for the whole run and applies every migration to it. */
export default async function setup() {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port: TEST_DB_PORT, host: '127.0.0.1' });
  await server.start();
  await migrate(`postgres://postgres:postgres@127.0.0.1:${TEST_DB_PORT}/postgres`, { log: () => undefined });
  return async () => {
    await server.stop();
    await db.close();
  };
}
