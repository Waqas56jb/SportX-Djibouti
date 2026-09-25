/**
 * Token from an auth email link. API-issued links use `?token=`; Supabase Auth links (password
 * recovery, email confirmation) redirect back with `#access_token=…&type=recovery|signup`.
 */
export function authLinkToken(search: URLSearchParams): string {
  const fromQuery = search.get('token');
  if (fromQuery) return fromQuery;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return hash.get('access_token') ?? '';
}
