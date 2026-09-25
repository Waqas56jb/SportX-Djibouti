/**
 * Service-layer configuration. Every service talks to the SPORTX REST API through
 * `services/api.ts`; the base URL comes from VITE_API_URL.
 */
export { API_BASE, API_ORIGIN } from './api';

/** @deprecated Use API_BASE from './api'. Kept for older imports. */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

