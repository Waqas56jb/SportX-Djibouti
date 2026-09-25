import { env } from '../../../config/env.js';
import { query, queryOne } from '../../../config/database.js';
import { randomToken } from '../../../utils/http.js';
import { supabaseAdmin, supabaseAnon } from '../../../config/supabase.js';
import { AppError, conflict, unauthorized } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { localProvider } from './local.provider.js';
import type { CredentialProvider } from './types.js';

async function appUserIdForAuthUser(authUserId: string): Promise<string> {
  const row = await queryOne<{ id: string }>(`select id from public.users where auth_user_id = $1 and deleted_at is null`, [authUserId]);
  if (!row) throw unauthorized('Account not found.');
  return row.id;
}

/** Validates a Supabase-issued token (recovery / confirmation link) and returns its auth user. */
async function authUserFromToken(token: string) {
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) throw unauthorized('This link is invalid or has expired. Please request a new one.');
  return data.user;
}

/**
 * Links an app user that still has legacy local credentials (created while AUTH_PROVIDER=local) to a
 * Supabase Auth user, creating it with `password` (or reusing an auth user with the same email), then
 * removes the local hash. Returns the auth user id.
 */
async function linkToSupabase(user: { id: string; email: string }, password: string, opts: { keepLocal?: boolean } = {}): Promise<string> {
  const created = await supabaseAdmin().auth.admin.createUser({ email: user.email, password, email_confirm: true, user_metadata: { app_user_id: user.id } });
  let authUserId = created.data.user?.id ?? null;
  if (!authUserId) {
    // Already registered in Supabase Auth (e.g. an earlier partial migration): reuse it and set the password.
    const existing = await queryOne<{ id: string }>(`select id from auth.users where lower(email) = lower($1)`, [user.email]);
    if (!existing) {
      logger.error({ err: created.error }, 'supabase account migration failed');
      throw new AppError('INTERNAL_ERROR', 'Could not sign you in. Please try again.');
    }
    authUserId = existing.id;
    const { error } = await supabaseAdmin().auth.admin.updateUserById(authUserId, { password, email_confirm: true });
    if (error) throw new AppError('INTERNAL_ERROR', 'Could not sign you in. Please try again.');
  }
  await query(`update public.users set auth_user_id = $2, updated_at = now() where id = $1`, [user.id, authUserId]);
  if (!opts.keepLocal) await query(`delete from public.auth_credentials where user_id = $1`, [user.id]);
  logger.info({ userId: user.id }, 'migrated local credentials to Supabase Auth');
  return authUserId;
}

/** True when the user still has a legacy scrypt hash from the local provider. */
async function hasLocalCredentials(userId: string): Promise<boolean> {
  return Boolean(await queryOne(`select 1 from public.auth_credentials where user_id = $1`, [userId]));
}

/**
 * Production provider: Supabase Auth stores and hashes credentials, sends confirmation and recovery
 * emails (configure templates/SMTP in the Supabase dashboard) and can later add Google/Apple OAuth.
 */
export const supabaseProvider: CredentialProvider = {
  name: 'supabase',

  async createCredentials({ userId, email, password, firstName, lastName }) {
    const client = env.EMAIL_VERIFICATION_REQUIRED ? supabaseAnon() : supabaseAdmin();
    const res = env.EMAIL_VERIFICATION_REQUIRED
      ? await client.auth.signUp({ email, password, options: { emailRedirectTo: `${env.FRONTEND_URL}/verify-email`, data: { app_user_id: userId, first_name: firstName, last_name: lastName } } })
      : await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { app_user_id: userId, first_name: firstName, last_name: lastName } });
    if (res.error || !res.data.user) {
      if (res.error?.status === 422 || /registered|exists/i.test(res.error?.message ?? '')) throw conflict('An account with this email already exists.');
      logger.error({ err: res.error }, 'supabase createCredentials failed');
      throw new AppError('INTERNAL_ERROR', 'Could not create the account. Please try again.');
    }
    return { authUserId: res.data.user.id };
  },

  async verifyPassword(user, password) {
    // Accounts created before the switch to Supabase Auth: verify the legacy hash once, then migrate.
    if (!user.authUserId) {
      if (!(await localProvider.verifyPassword(user, password))) return false;
      await linkToSupabase(user, password);
      return true;
    }
    const { data, error } = await supabaseAnon().auth.signInWithPassword({ email: user.email, password });
    if (error) {
      if (/not confirmed/i.test(error.message)) throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address before signing in.');
      // Linked during a password-reset request but still holding the legacy hash: finish the migration.
      if ((await hasLocalCredentials(user.id)) && (await localProvider.verifyPassword(user, password))) {
        const { error: updateError } = await supabaseAdmin().auth.admin.updateUserById(user.authUserId, { password });
        if (updateError) return false;
        await query(`delete from public.auth_credentials where user_id = $1`, [user.id]);
        return true;
      }
      return false;
    }
    // The Supabase session is not used; the API issues its own tokens.
    if (data.session) await supabaseAdmin().auth.admin.signOut(data.session.access_token).catch(() => undefined);
    return data.user?.id === user.authUserId;
  },

  async setPassword(user, password) {
    // Any legacy hash is obsolete once a new password is set.
    await query(`delete from public.auth_credentials where user_id = $1`, [user.id]);
    if (!user.authUserId) {
      const row = await queryOne<{ email: string }>(`select email from public.users where id = $1`, [user.id]);
      if (!row) throw new AppError('INTERNAL_ERROR', 'Account not found.');
      await linkToSupabase({ id: user.id, email: row.email }, password);
      return;
    }
    const { error } = await supabaseAdmin().auth.admin.updateUserById(user.authUserId, { password });
    if (error) throw new AppError('VALIDATION_ERROR', error.message);
  },

  async updateEmail(user, email) {
    if (!user.authUserId) return;
    const { error } = await supabaseAdmin().auth.admin.updateUserById(user.authUserId, { email, email_confirm: !env.EMAIL_VERIFICATION_REQUIRED });
    if (error) {
      if (/registered|exists/i.test(error.message)) throw conflict('Another account already uses this email.');
      throw new AppError('VALIDATION_ERROR', error.message);
    }
  },

  async sendPasswordReset(user, email, opts) {
    // Legacy local accounts must exist in Supabase Auth before Supabase can send them a recovery link.
    if (user && (await hasLocalCredentials(user.id))) {
      const linked = await queryOne<{ auth_user_id: string | null }>(`select auth_user_id from public.users where id = $1`, [user.id]);
      // Keep the legacy hash so the old password keeps working until the user resets or signs in.
      if (!linked?.auth_user_id) await linkToSupabase(user, `${randomToken(24)}Aa1`, { keepLocal: true });
    }
    // Supabase silently ignores unknown emails, so this never reveals account existence.
    const base = opts?.app === 'admin' ? env.ADMIN_FRONTEND_URL : env.FRONTEND_URL;
    const { error } = await supabaseAnon().auth.resetPasswordForEmail(email, { redirectTo: `${base}/reset-password` });
    if (error) logger.warn({ err: error.message }, 'supabase resetPasswordForEmail failed');
  },

  async consumePasswordReset(token) {
    const authUser = await authUserFromToken(token);
    return appUserIdForAuthUser(authUser.id);
  },

  async sendEmailVerification(user) {
    const { error } = await supabaseAnon().auth.resend({ type: 'signup', email: user.email, options: { emailRedirectTo: `${env.FRONTEND_URL}/verify-email` } });
    if (error) logger.warn({ err: error.message }, 'supabase resend verification failed');
  },

  async consumeEmailVerification(token) {
    const authUser = await authUserFromToken(token);
    if (!authUser.email_confirmed_at) throw unauthorized('Email address is not confirmed yet.');
    return appUserIdForAuthUser(authUser.id);
  },

  async deleteCredentials(user) {
    if (!user.authUserId) return;
    const { error } = await supabaseAdmin().auth.admin.deleteUser(user.authUserId);
    if (error) logger.warn({ err: error.message }, 'supabase deleteUser failed');
  },
};
