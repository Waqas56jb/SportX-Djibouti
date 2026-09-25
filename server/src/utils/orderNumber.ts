import type { Db } from '../config/database.js';

/**
 * SPX-2026-000001. Uses a per-year row in public.counters incremented with an atomic upsert,
 * so concurrent checkouts can never receive the same number.
 */
export async function nextOrderNumber(db: Db, prefix: string, date = new Date()): Promise<string> {
  const year = date.getUTCFullYear();
  const res = await db.query<{ n: number }>(`select public.next_counter($1) as n`, [`order:${year}`]);
  return `${prefix}-${year}-${String(res.rows[0].n).padStart(6, '0')}`;
}

export async function nextTicketNumber(db: Db): Promise<string> {
  const res = await db.query<{ n: number }>(`select public.next_counter('ticket') as n`);
  return `TKT-${String(1000 + Number(res.rows[0].n)).padStart(6, '0')}`;
}
