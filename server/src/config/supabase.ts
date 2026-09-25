import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let admin: SupabaseClient | null = null;
let anon: SupabaseClient | null = null;

/**
 * Service-role client (bypasses RLS). SERVER-SIDE ONLY — used for Auth admin operations and Storage.
 * The service role key must never be sent to a browser.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  admin ??= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** Anon client used for end-user auth flows (sign-in, refresh, password recovery). */
export function supabaseAnon(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_ANON_KEY).');
  anon ??= createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anon;
}
