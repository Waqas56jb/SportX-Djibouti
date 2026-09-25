import { env } from '../../../config/env.js';
import { queryOne } from '../../../config/database.js';
import { supabaseAdmin, supabaseAnon } from '../../../config/supabase.js';
import { AppError, conflict, unauthorized } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
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
    const { data, error } = await supabaseAnon().auth.signInWithPassword({ email: user.email, password });
    if (error) {
      if (/not confirmed/i.test(error.message)) throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address before signing in.');
      return false;
    }
    // The Supabase session is not used; the API issues its own tokens.
    if (data.session) await supabaseAdmin().auth.admin.signOut(data.session.access_token).catch(() => undefined);
    return data.user?.id === user.authUserId;
  },

  async setPassword(user, password) {
    if (!user.authUserId) throw new AppError('INTERNAL_ERROR', 'Account is not linked to Supabase Auth.');
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

  async sendPasswordReset(_user, email, opts) {
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
