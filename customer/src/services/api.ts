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
    throw new ApiError('We could not reach SPORTX. Check your connection and try again.', 0, 'NETWORK_ERROR');
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
    throw new ApiError(e?.message ?? (res.status >= 500 ? 'Something went wrong on our side. Please try again.' : 'Request failed.'), res.status, e?.code, e?.details);
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

/** New random key for idempotent POSTs (order placement, payments). */
export const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
