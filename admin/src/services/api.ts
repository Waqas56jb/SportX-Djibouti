/**
 * SPORTX API client (admin).
 *
 * - Base URL from VITE_API_URL; admin endpoints live under /api/v1/admin.
 * - Access token in memory only; the admin refresh token is an HttpOnly cookie (sportx_admin_rt)
 *   exchanged via POST /admin/auth/refresh on load and on an expired-token 401.
 * - Envelope { success, data, pagination? } — `request` unwraps `data`, `requestPage` keeps pagination.
 */

import { resolveApiUrl } from '@/constants/api';

const RAW = resolveApiUrl(import.meta.env.VITE_API_URL);
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
  noRefresh?: boolean;
  /** Return the raw Response (file downloads). */
  raw?: boolean;
}

let accessToken: string | null = null;
let expiresAt = 0;

export const tokenStore = {
  get: () => accessToken,
  set(token: string | null, expiresAtIso?: string | null) {
    accessToken = token;
    expiresAt = expiresAtIso ? new Date(expiresAtIso).getTime() : 0;
  },
  isExpiringSoon: () => Boolean(accessToken) && expiresAt > 0 && expiresAt - Date.now() < 30_000,
};

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

export interface AdminSessionPayload {
  accessToken: string;
  expiresAt: string;
  user: unknown;
  roles: { id: string; slug: string; name: string }[];
  permissions: string[];
}

let refreshing: Promise<AdminSessionPayload | null> | null = null;

/** Exchanges the admin refresh cookie for a new access token + identity. Null when signed out. */
export function refreshSession(): Promise<AdminSessionPayload | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/auth/refresh`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) {
        tokenStore.set(null);
        return null;
      }
      const json = (await res.json()) as { data: AdminSessionPayload };
      tokenStore.set(json.data.accessToken, json.data.expiresAt);
      return json.data;
    } catch {
      return null;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

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
        Accept: opts.raw ? '*/*' : 'application/json',
        ...(opts.body !== undefined && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      },
      body: opts.body === undefined ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the SPORTX API. Check your connection.', 0, 'NETWORK_ERROR');
  }
  if (res.status === 401 && token && !opts.noRefresh && !retried) {
    const fresh = await refreshSession();
    if (fresh) return send(path, opts, true);
    onSessionExpired?.();
  }
  return res;
}

async function parse<T>(res: Response): Promise<T> {
  let json: { success?: boolean; error?: { code?: string; message?: string; details?: unknown } } | null = null;
  try {
    json = await res.json();
  } catch {
    /* no JSON body */
  }
  if (!res.ok || json?.success === false) {
    const e = json?.error;
    throw new ApiError(e?.message ?? (res.status >= 500 ? 'Something went wrong. Please try again.' : 'Request failed.'), res.status, e?.code, e?.details);
  }
  return (json ?? { data: undefined }) as T;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return (await parse<{ data: T }>(await send(path, opts))).data;
}

export async function requestPage<T, X = Record<string, unknown>>(path: string, opts: RequestOptions = {}): Promise<PageResult<T, X>> {
  const { success: _s, ...rest } = await parse<PageResult<T, X> & { success: boolean }>(await send(path, opts));
  return rest as PageResult<T, X>;
}

/** Downloads a server-generated file (e.g. `?format=csv` reports) with the auth header attached. */
export async function download(path: string, query: Query, filename: string) {
  const res = await send(path, { query, raw: true });
  if (!res.ok) await parse(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Admin-scoped helpers: `adminApi.get('/orders')` → GET /api/v1/admin/orders. */
export const adminApi = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(`/admin${path}`, { query, signal }),
  page: <T, X = Record<string, unknown>>(path: string, query?: Query, signal?: AbortSignal) => requestPage<T, X>(`/admin${path}`, { query, signal }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(`/admin${path}`, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(`/admin${path}`, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(`/admin${path}`, { method: 'PUT', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(`/admin${path}`, { method: 'DELETE', body }),
  upload: <T>(path: string, file: File, fields: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    return request<T>(`/admin${path}`, { method: 'POST', body: fd });
  },
};

export const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
