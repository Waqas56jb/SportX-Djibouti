import { env } from '../../../config/env.js';
import { pool, query, queryOne, type Db } from '../../../config/database.js';
import { randomToken, sha256 } from '../../../utils/http.js';
import { unauthorized } from '../../../utils/errors.js';
import { emailService } from '../../../services/email/email.service.js';
import { hashPassword, verifyPassword } from '../password.js';
import type { CredentialProvider } from './types.js';

const RESET_TTL_MIN = 30;
const VERIFY_TTL_HOURS = 48;

async function issueToken(userId: string, purpose: 'PASSWORD_RESET' | 'EMAIL_VERIFICATION', ttlMs: number): Promise<string> {
  const token = randomToken(32);
  // Invalidate earlier tokens of the same purpose.
  await query(`update public.auth_tokens set used_at = now() where user_id = $1 and purpose = $2 and used_at is null`, [userId, purpose]);
  await query(`insert into public.auth_tokens (user_id, purpose, token_hash, expires_at) values ($1, $2, $3, $4)`, [
    userId,
    purpose,
    sha256(token),
    new Date(Date.now() + ttlMs).toISOString(),
  ]);
  return token;
}

async function consume(token: string, purpose: 'PASSWORD_RESET' | 'EMAIL_VERIFICATION'): Promise<string> {
  const row = await queryOne<{ user_id: string }>(
    `update public.auth_tokens set used_at = now()
     where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now()
     returning user_id`,
    [sha256(token), purpose],
  );
  if (!row) throw unauthorized('This link is invalid or has expired. Please request a new one.');
  return row.user_id;
}

/** Development / test provider: scrypt hashes in public.auth_credentials, tokens in public.auth_tokens. */
export const localProvider: CredentialProvider = {
  name: 'local',

  async createCredentials({ userId, password }, db: Db) {
    await query(`insert into public.auth_credentials (user_id, password_hash) values ($1, $2)`, [userId, await hashPassword(password)], db);
    return { authUserId: null };
  },

  async verifyPassword(user, password) {
    const row = await queryOne<{ password_hash: string }>(`select password_hash from public.auth_credentials where user_id = $1`, [user.id]);
    return row ? verifyPassword(password, row.password_hash) : false;
  },

  async setPassword(user, password, db = pool) {
    await query(
      `insert into public.auth_credentials (user_id, password_hash) values ($1, $2)
       on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`,
      [user.id, await hashPassword(password)],
      db,
    );
  },

  async updateEmail() {
    /* email lives only in public.users for the local provider */
  },

  async sendPasswordReset(user, _email, opts) {
    if (!user) return;
    const token = await issueToken(user.id, 'PASSWORD_RESET', RESET_TTL_MIN * 60_000);
    const base = opts?.app === 'admin' ? env.ADMIN_FRONTEND_URL : env.FRONTEND_URL;
    await emailService.send('password_reset', user.email, { firstName: user.firstName, link: `${base}/reset-password?token=${token}`, minutes: RESET_TTL_MIN });
  },

  consumePasswordReset: (token) => consume(token, 'PASSWORD_RESET'),

  async sendEmailVerification(user) {
    const token = await issueToken(user.id, 'EMAIL_VERIFICATION', VERIFY_TTL_HOURS * 3_600_000);
    await emailService.send('email_verification', user.email, { firstName: user.firstName, link: `${env.FRONTEND_URL}/verify-email?token=${token}` });
  },

  consumeEmailVerification: (token) => consume(token, 'EMAIL_VERIFICATION'),

  async deleteCredentials(user) {
    await query(`delete from public.auth_credentials where user_id = $1`, [user.id]);
  },
};
