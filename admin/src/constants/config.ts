import { API_BASE } from '@/services/api';

/**
 * Public runtime configuration. Only VITE_* variables are exposed to the browser,
 * so this file must never read or contain secrets.
 *
 * The admin talks to the real SPORTX API (VITE_API_URL). `useMocks` is always false.
 */
export const appConfig = {
  /** e.g. http://localhost:4100/api/v1 */
  apiBaseUrl: API_BASE,
  useMocks: false,
} as const;
