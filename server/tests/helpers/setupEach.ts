import { afterAll } from 'vitest';
import { pool } from '../../src/config/database.js';
import { jobs } from '../../src/services/jobs.js';

afterAll(async () => {
  await jobs.drain();
  await pool.end();
});
