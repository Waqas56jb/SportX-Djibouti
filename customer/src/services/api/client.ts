/**
 * Legacy entry point — re-exports the shared SPORTX API client (`services/api.ts`) so older
 * imports (`apiClient`, `ApiError`) keep working. New code should import from '@/services/api'.
 */
export { api as apiClient, api, ApiError, request, requestPage, tokenStore, refreshSession, newIdempotencyKey } from '../api';
export type { Pagination, PageResult, Query } from '../api';
