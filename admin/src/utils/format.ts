import type { CurrencyCode } from '@/types';

/**
 * Store currency is held in settings; formatters read it through this setter so
 * that plain functions (tables, CSV exports) stay framework-free.
 * Changing currency relabels amounts — it does not convert them.
 */
let activeCurrency: CurrencyCode = 'DJF';
export function setActiveCurrency(code: CurrencyCode) {
  activeCurrency = code;
}
export function getActiveCurrency(): CurrencyCode {
  return activeCurrency;
}

const CURRENCY_DECIMALS: Record<CurrencyCode, number> = { DJF: 0, USD: 2, EUR: 2 };

export function formatMoney(amount: number, opts: { currency?: CurrencyCode; compact?: boolean } = {}): string {
  const currency = opts.currency ?? activeCurrency;
  const decimals = CURRENCY_DECIMALS[currency];
  if (opts.compact && Math.abs(amount) >= 10_000) {
    return `${currency} ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(amount)}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(amount)
    .replace(/ /g, ' ');
}

export function formatNumber(n: number, opts: { compact?: boolean; decimals?: number } = {}): string {
  if (opts.compact && Math.abs(n) >= 10_000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: opts.decimals ?? 0, minimumFractionDigits: opts.decimals ?? 0 }).format(n);
}

export function formatPercent(n: number, opts: { signed?: boolean; decimals?: number } = {}): string {
  const d = opts.decimals ?? 1;
  const s = `${Math.abs(n).toFixed(d)}%`;
  if (!opts.signed) return `${n < 0 ? '-' : ''}${s}`;
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${s}`;
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const shortFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });

export const formatDate = (iso?: string) => (iso ? dateFmt.format(new Date(iso)) : '—');
export const formatDateTime = (iso?: string) => (iso ? dateTimeFmt.format(new Date(iso)) : '—');
export const formatTime = (iso?: string) => (iso ? timeFmt.format(new Date(iso)) : '—');
export const formatShortDate = (iso?: string) => (iso ? shortFmt.format(new Date(iso)) : '—');

export function formatRelative(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  const wrap = (s: string) => (future ? `in ${s}` : `${s} ago`);
  if (m < 1) return 'just now';
  if (m < 60) return wrap(`${m}m`);
  const h = Math.round(m / 60);
  if (h < 24) return wrap(`${h}h`);
  const d = Math.round(h / 24);
  if (d < 30) return wrap(`${d}d`);
  return formatDate(iso);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Value for <input type="date"> from an ISO string, in local time (Djibouti is UTC+3). */
export const toDateInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** Value for <input type="datetime-local"> from an ISO string, in local time. */
export const toDateTimeInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${toDateInput(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** ISO string for the end of a local day from an <input type="date"> value. */
export const endOfDayIso = (v: string) => (v ? new Date(`${v}T23:59:59.999`).toISOString() : '');
/** ISO string from an <input type="date"> value (start of day, local). */
export const fromDateInput = (v: string) => (v ? new Date(`${v}T00:00:00`).toISOString() : '');

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
