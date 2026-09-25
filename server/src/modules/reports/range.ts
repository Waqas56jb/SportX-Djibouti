import { z } from 'zod';
import { pool, queryOne, type Db } from '../../config/database.js';
import { badRequest } from '../../utils/errors.js';
import { getStoreSettings } from '../settings/settings.service.js';

/**
 * Reporting periods. All bucketing happens in the store's timezone (store_settings.timezone), so
 * "today" and day/month boundaries match what staff in Djibouti see on the wall clock.
 *
 * Current period  = [from, to)  — for presets `to` is now(), so "today" is today-so-far.
 * Previous period = [from - span, to - span) — the same-length window immediately before
 * (for "today" that is yesterday up to the same time of day, so the comparison is fair).
 */
export const PRESETS = ['today', '7d', '30d', '3m', '12m', 'custom'] as const;
export const BUCKETS = ['hour', 'day', 'week', 'month'] as const;
export type Preset = (typeof PRESETS)[number];
export type Bucket = (typeof BUCKETS)[number];

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD.').transform((s) => s.slice(0, 10));

export const rangeQuery = z.object({
  range: z.enum(PRESETS).default('30d'),
  // Accept both from/to and date_from/date_to (admin list convention).
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  date_from: dateOnly.optional(),
  date_to: dateOnly.optional(),
});
export type RangeQuery = z.infer<typeof rangeQuery>;

export interface ResolvedRange {
  preset: Preset;
  label: string;
  bucket: Bucket;
  timezone: string;
  /** ISO timestamps. `to` is exclusive. */
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  days: number;
}

const LABELS: Record<Preset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '3m': 'Last 3 months',
  '12m': 'Last 12 months',
  custom: 'Custom range',
};

// Whitelisted SQL per preset ($1 = timezone, $2 = custom from date, $3 = custom to date).
const START: Record<Exclude<Preset, 'custom'>, string> = {
  today: `b.today`,
  '7d': `b.today - interval '6 days'`,
  '30d': `b.today - interval '29 days'`,
  '3m': `b.today - interval '90 days'`,
  '12m': `(date_trunc('month', b.n at time zone $1) - interval '11 months') at time zone $1`,
};
const SPAN: Record<Exclude<Preset, 'custom'>, string> = {
  today: `interval '1 day'`,
  '7d': `interval '7 days'`,
  '30d': `interval '30 days'`,
  '3m': `interval '91 days'`,
  '12m': `interval '12 months'`,
};
const DEFAULT_BUCKET: Record<Exclude<Preset, 'custom'>, Bucket> = { today: 'hour', '7d': 'day', '30d': 'day', '3m': 'week', '12m': 'month' };

export async function resolveRange(q: Partial<RangeQuery>, bucketOverride?: Bucket, db: Db = pool): Promise<ResolvedRange> {
  const preset: Preset = q.range ?? '30d';
  const tz = (await getStoreSettings()).timezone || 'UTC';
  const fromDate = q.from ?? q.date_from;
  const toDate = q.to ?? q.date_to;

  let sql: string;
  let params: unknown[];
  if (preset === 'custom') {
    if (!fromDate || !toDate) throw badRequest('A custom range needs both "from" and "to" dates (YYYY-MM-DD).');
    if (fromDate > toDate) throw badRequest('"from" must be on or before "to".');
    sql = `with b as (select now() as n),
                r as (select ($2::date)::timestamp at time zone $1 as s, (($3::date) + 1)::timestamp at time zone $1 as e from b)
           select r.s as from, least(r.e, b.n) as to, r.s - (r.e - r.s) as prev_from, least(r.e, b.n) - (r.e - r.s) as prev_to,
                  ($3::date - $2::date) + 1 as days
             from r, b`;
    params = [tz, fromDate, toDate];
  } else {
    sql = `with b as (select now() as n, date_trunc('day', now() at time zone $1) at time zone $1 as today),
                r as (select ${START[preset]} as s, b.n as e from b)
           select r.s as from, r.e as to, r.s - ${SPAN[preset]} as prev_from, r.e - ${SPAN[preset]} as prev_to,
                  greatest(1, ceil(extract(epoch from (r.e - r.s)) / 86400))::int as days
             from r, b`;
    params = [tz];
  }
  const row = await queryOne<{ from: Date; to: Date; prev_from: Date; prev_to: Date; days: number }>(sql, params, db);
  const days = Number(row!.days);
  const bucket: Bucket =
    bucketOverride ?? (preset === 'custom' ? (days <= 1 ? 'hour' : days <= 62 ? 'day' : days <= 190 ? 'week' : 'month') : DEFAULT_BUCKET[preset]);
  return {
    preset,
    label: LABELS[preset],
    bucket,
    timezone: tz,
    from: row!.from.toISOString(),
    to: row!.to.toISOString(),
    previousFrom: row!.prev_from.toISOString(),
    previousTo: row!.prev_to.toISOString(),
    days,
  };
}

const LABEL_FORMAT: Record<Bucket, string> = { hour: 'HH24:00', day: 'DD Mon', week: 'DD Mon', month: 'Mon YY' };

/**
 * CTE `buckets(start_at, end_at, label)`: every bucket in the range, zero-filled by generate_series.
 * Bucket bounds are clamped to the range. Uses $1 = timezone, $2 = from, $3 = to.
 * `bucket` is a whitelisted enum value, never user text.
 */
export function bucketsCte(bucket: Bucket): string {
  if (!BUCKETS.includes(bucket)) throw new Error('invalid bucket');
  return `buckets as (
    select greatest(g at time zone $1, $2::timestamptz) as start_at,
           least((g + interval '1 ${bucket}') at time zone $1, $3::timestamptz) as end_at,
           to_char(g, '${LABEL_FORMAT[bucket]}') as label
      from generate_series(
             date_trunc('${bucket}', $2::timestamptz at time zone $1),
             date_trunc('${bucket}', ($3::timestamptz - interval '1 microsecond') at time zone $1),
             interval '1 ${bucket}') g
  )`;
}

/** Percentage change, one decimal. null when there is no baseline to compare with. */
export function pctChange(value: number, previous: number): number | null {
  if (!previous) return value ? null : 0;
  return Math.round(((value - previous) / previous) * 1000) / 10;
}

/**
 * Revenue definition used across the dashboard and reports:
 *   paid orders = payment_status in (PAID, PARTIALLY_REFUNDED, REFUNDED), not soft-deleted;
 *   revenue     = grand_total - refunded_total of those orders, attributed to the order's placed_at.
 * Product / category breakdowns use order_items.line_total of non-cancelled orders.
 */
export const PAID = `o.payment_status in ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') and o.deleted_at is null`;
export const NOT_CANCELLED = `o.status <> 'CANCELLED' and o.deleted_at is null`;

/** Reads `range`/`from`/`to` plus an optional `groupBy` override. */
export const reportQuery = rangeQuery.extend({
  groupBy: z.enum(BUCKETS).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});
export type ReportQuery = z.infer<typeof reportQuery>;
