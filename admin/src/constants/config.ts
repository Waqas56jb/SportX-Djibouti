/**
 * Public runtime configuration. Only VITE_* variables are exposed to the browser,
 * so this file must never read or contain secrets.
 */
export const appConfig = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '',
  useMocks: (import.meta.env.VITE_USE_MOCKS as string | undefined) !== 'false',
  /** Simulated network latency for mock services, in ms. */
  mockLatency: 350,
} as const;
