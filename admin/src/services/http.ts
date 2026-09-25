/**
 * Legacy façade kept for modules that still import from '@/services/http'.
 * Everything delegates to the shared API client in './api' (auth header, refresh, envelope unwrapping).
 * Paths are admin-relative: `api.get('/orders')` → GET /api/v1/admin/orders.
 */
import { adminApi, ApiError, type Query } from './api';

export { ApiError };

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) => adminApi.get<T>(path, query as Query),
  post: <T>(path: string, body?: unknown) => adminApi.post<T>(path, body),
  put: <T>(path: string, body?: unknown) => adminApi.put<T>(path, body),
  patch: <T>(path: string, body?: unknown) => adminApi.patch<T>(path, body),
  delete: <T>(path: string) => adminApi.delete<T>(path),
};
