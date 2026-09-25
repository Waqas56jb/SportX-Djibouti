/**
 * SPORTX API client (customer storefront).
 *
 * - Base URL from VITE_API_URL (e.g. https://api.sportx.dj); every path is under /api/v1.
 * - Access token is kept in memory only. The refresh token lives in an HttpOnly cookie set by the
 *   API, so it is never readable by JavaScript. On load (or on a 401 "expired") the client calls
 *   POST /auth/refresh once and retries.
 * - Responses use the envelope { success, data, message?, pagination? } — `request` unwraps `data`;
 *   `requestPage` also returns pagination and any extra keys (facets, unreadCount…).
 */

import { currentLang, t, tDynamic, type TKey } from '@/i18n';

const RAW = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const API_ORIGIN = RAW;
export const API_BASE = `${RAW}/api/v1`;

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export type PageResult<T, X = Record<string, unknown>> = { data: T[]; pagination: Pagination } & X;

type QueryValue = string | number | boolean | null | undefined | (string | number)[];
export type Query = Record<string, QueryValue>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  idempotencyKey?: string;
  /** Skip the automatic refresh-and-retry (used by the auth endpoints themselves). */
  noRefresh?: boolean;
}

// ─── Access token (memory only) ─────────────────────────────────────────────
let accessToken: string | null = null;
let expiresAt = 0;
const listeners = new Set<(token: string | null) => void>();

export const tokenStore = {
  get: () => accessToken,
  set(token: string | null, expiresAtIso?: string | null) {
    accessToken = token;
    expiresAt = expiresAtIso ? new Date(expiresAtIso).getTime() : 0;
    listeners.forEach((l) => l(token));
  },
  subscribe(fn: (token: string | null) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  isExpiringSoon: () => Boolean(accessToken) && expiresAt > 0 && expiresAt - Date.now() < 30_000,
};

/** Called when the session can no longer be refreshed (the auth store signs the user out). */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, String(v)));
    else url.searchParams.set(key, String(value));
  }
  return url.toString();
}

// ─── Refresh (single flight) ────────────────────────────────────────────────
let refreshing: Promise<string | null> | null = null;

export interface SessionPayload {
  accessToken: string;
  expiresAt: string;
  user: unknown;
}

/** Exchanges the HttpOnly refresh cookie for a new access token. Resolves null when there is no session. */
export function refreshSession(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) {
        tokenStore.set(null);
        return null;
      }
      const json = (await res.json()) as { data: SessionPayload };
      tokenStore.set(json.data.accessToken, json.data.expiresAt);
      lastRefreshUser = json.data.user;
      return json.data.accessToken;
    } catch {
      return null;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}
let lastRefreshUser: unknown = null;
/** User returned by the most recent successful refresh (used on app start). */
export const consumeRefreshedUser = () => {
  const u = lastRefreshUser;
  lastRefreshUser = null;
  return u;
};

async function send(path: string, opts: RequestOptions, retried = false): Promise<Response> {
  if (!opts.noRefresh && tokenStore.isExpiringSoon()) await refreshSession();
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      signal: opts.signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      },
      body: opts.body === undefined ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(t('common.errors.network'), 0, 'NETWORK_ERROR');
  }
  if (res.status === 401 && token && !opts.noRefresh && !retried) {
    const fresh = await refreshSession();
    if (fresh) return send(path, opts, true);
    onSessionExpired?.();
  }
  return res;
}

async function parse<T>(res: Response): Promise<T> {
  let json: { success?: boolean; data?: unknown; error?: { code?: string; message?: string; details?: unknown } } | null = null;
  try {
    json = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok || json?.success === false) {
    const e = json?.error;
    throw new ApiError(e?.message ?? (res.status >= 500 ? t('common.errors.server') : t('common.errors.requestFailed')), res.status, e?.code, e?.details);
  }
  return (json ?? { data: undefined }) as T;
}

/** Returns the unwrapped `data` of a success envelope. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const json = await parse<{ data: T }>(await send(path, opts));
  return json.data;
}

/** Returns `{ data, pagination, ...extras }` for paginated endpoints. */
export async function requestPage<T, X = Record<string, unknown>>(path: string, opts: RequestOptions = {}): Promise<PageResult<T, X>> {
  const json = await parse<PageResult<T, X> & { success: boolean }>(await send(path, opts));
  const { success: _s, ...rest } = json;
  return rest as PageResult<T, X>;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  page: <T, X = Record<string, unknown>>(path: string, query?: Query, signal?: AbortSignal) => requestPage<T, X>(path, { query, signal }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  upload: <T>(path: string, file: File, fields: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    return request<T>(path, { method: 'POST', body: fd });
  },
};

// ─── Localised error messages ───────────────────────────────────────────────
/** Server messages (English) that customers commonly see, mapped to translated equivalents. */
const KNOWN_MESSAGES: Record<string, TKey> = {
  'Incorrect email or password.': 'common.errors.msg.badCredentials',
  'Account not found.': 'common.errors.msg.accountNotFound',
  'Session expired. Please sign in again.': 'common.errors.msg.sessionExpired',
  'Access token expired.': 'common.errors.msg.sessionExpired',
  'Invalid access token.': 'common.errors.msg.sessionExpired',
  'No active session.': 'common.errors.msg.sessionExpired',
  'Authentication required.': 'common.errors.code.UNAUTHORIZED',
  'An account with this email already exists.': 'common.errors.msg.emailExists',
  'Another account already uses this email.': 'common.errors.msg.emailInUse',
  'This link is invalid or has expired. Please request a new one.': 'common.errors.msg.linkExpired',
  'Please verify your email address before signing in.': 'common.errors.msg.verifyEmail',
  'Email address is not confirmed yet.': 'common.errors.msg.verifyEmail',
  'This account has been blocked.': 'common.errors.msg.accountBlocked',
  'This account has been blocked. Please contact SPORTX.': 'common.errors.msg.accountBlocked',
  'This account is inactive.': 'common.errors.msg.accountInactive',
  'This account is inactive. Please contact SPORTX.': 'common.errors.msg.accountInactive',
  'Your bag is empty.': 'common.errors.msg.bagEmpty',
  'Not enough stock available.': 'common.errors.msg.notEnoughStock',
  'This item is no longer available.': 'common.errors.msg.itemUnavailable',
  'This shipping method is not available.': 'common.errors.msg.shippingUnavailable',
  'A delivery address is required for this shipping method.': 'common.errors.msg.addressRequired',
  'We could not find that order on your account.': 'common.errors.msg.orderNotFound',
  'This order is already being prepared and can no longer be cancelled. Please contact support.': 'common.errors.msg.cannotCancel',
  'This order has not been paid yet.': 'common.errors.msg.notPaid',
  'This order is already paid.': 'common.errors.msg.alreadyPaid',
  'This account cannot place orders.': 'common.errors.msg.cannotOrder',
  'You have orders in progress. Your account can be deleted once they are delivered or cancelled.': 'common.errors.msg.ordersInProgress',
  'This code is not valid.': 'common.errors.msg.couponInvalid',
  'This code has reached its usage limit.': 'common.errors.msg.couponLimit',
  'Add items to your bag before applying a code.': 'common.errors.msg.couponEmptyBag',
  'Enter your current password to change your email address.': 'common.errors.msg.currentPasswordRequired',
  'You can review products you have received.': 'common.errors.msg.reviewReceivedOnly',
  'File is too large.': 'common.errors.msg.fileTooLarge',
  'Request body is too large.': 'common.errors.msg.fileTooLarge',
  'Only JPEG, PNG, WebP or AVIF images are allowed.': 'common.errors.msg.imageType',
  'The file is not a valid JPEG, PNG, WebP or AVIF image.': 'common.errors.msg.imageType',
  'Could not create the account. Please try again.': 'common.errors.msg.accountCreateFailed',
  'Too many requests. Please wait a moment and try again.': 'common.errors.msg.tooManyRequests',
  'Something went wrong. Please try again.': 'common.errors.generic',
};

/** Server messages with variable parts. */
const MESSAGE_PATTERNS: [RegExp, TKey, (m: RegExpMatchArray) => Record<string, string | number>][] = [
  [/^Only (\d+) left of (.+)\.$/, 'common.errors.msg.onlyLeft', (m) => ({ count: Number(m[1]), name: m[2] })],
  [/^(.+) is out of stock\.$/, 'common.errors.msg.itemOutOfStock', (m) => ({ name: m[1] })],
  [/^You can buy up to (\d+) of this item per order\.$/, 'common.errors.msg.maxPerOrder', (m) => ({ count: Number(m[1]) })],
  [/^Your wishlist can hold up to (\d+) products\.$/, 'common.errors.msg.wishlistFull', (m) => ({ count: Number(m[1]) })],
  [/^You can save up to (\d+) addresses\.$/, 'common.errors.msg.addressesFull', (m) => ({ count: Number(m[1]) })],
  [/ is not available right now\.$/, 'common.errors.msg.methodUnavailable', () => ({})],
];

/**
 * Translates a known server message (e.g. checkout `problems`) into the current language.
 * English, and messages we don't recognise, are returned unchanged.
 */
export function localizeServerMessage(message: string): string {
  if (currentLang() === 'en' || !message) return message;
  const known = KNOWN_MESSAGES[message];
  if (known) return t(known);
  for (const [re, key, vars] of MESSAGE_PATTERNS) {
    const m = message.match(re);
    if (m) return t(key, vars(m));
  }
  return message;
}

/**
 * Customer-facing text for an API error. English keeps the server's specific message. Other
 * languages get a translation of the known message, else a translated message for the error code
 * (or the caller's already-translated `fallback` for unexpected server errors), so French and
 * Arabic customers never see raw English for common failures.
 */
export function localizeApiError(err: ApiError, fallback?: string): string {
  // Client-side messages (network, empty body) are produced with t() already.
  if (currentLang() === 'en' || !err.code || err.code === 'NETWORK_ERROR') return err.message || fallback || t('common.errors.generic');
  const known = KNOWN_MESSAGES[err.message];
  if (known) return t(known);
  for (const [re, key, vars] of MESSAGE_PATTERNS) {
    const m = err.message.match(re);
    if (m) return t(key, vars(m));
  }
  if (err.code === 'INTERNAL_ERROR' && fallback) return fallback;
  return tDynamic(`common.errors.code.${err.code}`, fallback ?? t('common.errors.generic'));
}

/** New random key for idempotent POSTs (order placement, payments). */
export const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
