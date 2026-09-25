/** Production API origin. Used when VITE_API_URL is missing, local, or the retired 502 host. */
export const PRODUCTION_API_URL = 'https://vigilant-respect-production-14a3.up.railway.app';
const RETIRED_API_URL = 'https://lucky-celebration-production-b94f.up.railway.app';

export function resolveApiUrl(raw: string | undefined): string {
  const fromEnv = raw?.trim().replace(/\/$/, '') ?? '';
  const looksLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fromEnv);
  if (import.meta.env.PROD && (!fromEnv || looksLocal || fromEnv === RETIRED_API_URL)) return PRODUCTION_API_URL;
  return fromEnv;
}
