import { STORAGE_KEYS } from '@/constants/storage';
import { storage } from '@/utils/storage';
import { API_URL } from '../config';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${API_URL}${path}`, window.location.origin);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
    else url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function authToken(): string | undefined {
  type Persisted = { state?: { session?: { token?: string } } };
  const persisted =
    storage.get<Persisted | null>(STORAGE_KEYS.auth, null) ?? storage.get<Persisted>(STORAGE_KEYS.auth, {}, sessionStorage);
  return persisted.state?.session?.token;
}

/** Thin fetch wrapper for the future SPORTX REST API. */
async function request<T>(path: string, { method = 'GET', body, query, signal }: RequestOptions = {}): Promise<T> {
  const token = authToken();
  const res = await fetch(buildUrl(path, query), {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = 'Something went wrong. Please try again.';
    let code: string | undefined;
    try {
      const data = (await res.json()) as { message?: string; code?: string };
      message = data.message ?? message;
      code = data.code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status, code);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const apiClient = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
