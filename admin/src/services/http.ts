import { appConfig } from '@/constants/config';

/**
 * Thin REST client for the future Node.js API.
 * Services call `api.*` when `appConfig.useMocks` is false. The auth token is attached from session storage.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

let tokenGetter: () => string | null = () => null;
export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Record<string, unknown>): Promise<T> {
  const url = new URL(path.replace(/^\//, ''), appConfig.apiBaseUrl.endsWith('/') ? appConfig.apiBaseUrl : `${appConfig.apiBaseUrl}/`);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '' && v !== null) url.searchParams.set(k, String(v));
  const token = tokenGetter();
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) {
    let message = 'Something went wrong.';
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
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
