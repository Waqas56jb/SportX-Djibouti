import type { CouponType, FlashSaleStatus } from '@/types';
import type { StatusMeta } from '@/constants/status';
import { ApiError } from '@/services/api';
import { formatMoney } from '@/utils/format';

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" in local time (the shared toDateInput slices the UTC string, which shifts a day east of UTC). */
export function toLocalDateInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DDTHH:mm" in local time for <input type="datetime-local">. */
export function toLocalDateTimeInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${toLocalDateInput(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO string from a local date or datetime-local value. */
export function fromLocalInput(v: string): string {
  if (!v) return '';
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** ISO string for the last second of a local calendar day. */
export function endOfDayIso(v: string): string {
  if (!v) return '';
  const d = new Date(`${v}T23:59:59`);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

const CODE_PREFIXES = ['SPX', 'GOAL', 'MATCH', 'HOOPS', 'RUN', 'TEAM', 'KICK'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCouponCode(): string {
  const prefix = CODE_PREFIXES[Math.floor(Math.random() * CODE_PREFIXES.length)];
  let tail = '';
  for (let i = 0; i < 5; i++) tail += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `${prefix}-${tail}`;
}

export const COUPON_CODE_RE = /^[A-Z0-9_-]{3,32}$/;

/** "15%" or "DJF 2,000". */
export function discountLabel(type: CouponType, value: number): string {
  return type === 'percentage' ? `${value}%` : formatMoney(value);
}

/** Discount a coupon gives on a basket, honouring minimum order and maximum discount caps. */
export function computeDiscount(c: { type: CouponType; value: number; minOrder: number; maxDiscount?: number }, basket: number): { applies: boolean; discount: number } {
  if (basket <= 0 || basket < c.minOrder) return { applies: false, discount: 0 };
  let d = c.type === 'percentage' ? Math.round((basket * c.value) / 100) : c.value;
  if (c.type === 'percentage' && c.maxDiscount) d = Math.min(d, c.maxDiscount);
  return { applies: true, discount: Math.min(d, basket) };
}

/** Compact duration: "2d 4h", "14h 22m", "8m", "<1m". */
export function formatDuration(ms: number): string {
  const abs = Math.max(0, ms);
  const m = Math.floor(abs / 60000);
  if (m < 1) return '<1m';
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return `${h}h ${pad(mm)}m`;
  return `${mm}m`;
}

/** Elapsed share of a date range, clamped 0..1. */
export function rangeProgress(startIso: string, endIso: string, now: number): number {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (e <= s) return now >= e ? 1 : 0;
  return Math.min(1, Math.max(0, (now - s) / (e - s)));
}

export const FLASH_SALE_STATUS: Record<FlashSaleStatus, StatusMeta> = {
  active: { label: 'Live', tone: 'success' },
  upcoming: { label: 'Upcoming', tone: 'info' },
  ended: { label: 'Ended', tone: 'muted' },
  disabled: { label: 'Disabled', tone: 'neutral' },
};

/** Lists names compactly: "Football, Boots +2". */
export function nameList(names: string[], max = 2): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max}`;
}

export const errorMessage = (e: unknown, fallback = 'Please try again.') => (e instanceof Error && e.message ? e.message : fallback);

type FlattenedZod = { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
const isFlattened = (v: unknown): v is FlattenedZod => Boolean(v) && typeof v === 'object' && 'fieldErrors' in (v as object);

/**
 * Field-level messages from an API error. Understands the server's shapes:
 * zod `{ body: { fieldErrors } }` / `{ fieldErrors }`, service `{ field: "message" }`,
 * unknown-target `{ productIds: [ids] }` (uses the error message) and `409 { code: "code_taken" }`.
 * Keys are API field paths; `alias` renames them to form keys.
 */
export function apiFieldErrors(err: unknown, alias: Record<string, string> = {}): Record<string, string> {
  if (!(err instanceof ApiError) || !err.details || typeof err.details !== 'object') return {};
  const d = err.details as Record<string, unknown>;
  const out: Record<string, string> = {};
  const put = (k: string, msg: string) => {
    const key = alias[k] ?? k;
    if (!out[key]) out[key] = msg;
  };
  if (err.status === 409) {
    if (d.code === 'code_taken') put('code', err.message);
    return out;
  }
  const read = (f: FlattenedZod) => Object.entries(f.fieldErrors ?? {}).forEach(([k, v]) => v?.[0] && put(k, v[0]));
  if (isFlattened(d)) read(d);
  for (const part of ['body', 'query', 'params']) {
    const v = (err.details as Record<string, unknown>)[part];
    if (isFlattened(v)) read(v);
  }
  if (!Object.keys(out).length) {
    for (const [k, v] of Object.entries(d)) {
      if (typeof v === 'string' && k !== 'field') put(k, v);
      else if (Array.isArray(v)) put(k, err.message);
    }
  }
  return out;
}

/**
 * Applies server validation errors to a form (only keys the form knows about).
 * Returns true when at least one field was flagged, so callers can pick the toast wording.
 */
export function applyApiErrors<K extends string>(err: unknown, keys: readonly K[], setErrors: (e: Partial<Record<K, string>>) => void, alias: Record<string, K> = {}): boolean {
  const all = apiFieldErrors(err, alias);
  const known = Object.fromEntries(Object.entries(all).filter(([k]) => (keys as readonly string[]).includes(k))) as Partial<Record<K, string>>;
  if (!Object.keys(known).length) return false;
  setErrors(known);
  return true;
}
