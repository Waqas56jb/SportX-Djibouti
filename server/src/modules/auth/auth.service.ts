import { env } from '../../config/env.js';
import { query, queryOne, withTransaction } from '../../config/database.js';
import { AppError, conflict, unauthorized } from '../../utils/errors.js';
import { emailService } from '../../services/email/email.service.js';
import { notificationService } from '../../services/notification/notification.service.js';
import { credentials } from './providers/index.js';
import { issueSession, revokeAllSessions, type TokenScope } from './tokens.js';
import { invalidateAuthContext, loadAuthContext } from './auth.context.js';
import { toPublicUser, USER_COLUMNS, type UserRow } from '../users/users.mapper.js';
import type { IssuedSession } from '../../types/auth.js';

interface Meta {
  userAgent?: string;
  ip?: string;
}

type FullUserRow = UserRow & { auth_user_id: string | null };

async function findUserByEmail(email: string): Promise<FullUserRow | null> {
  return queryOne<FullUserRow>(`select ${USER_COLUMNS}, u.auth_user_id from public.users u where lower(u.email) = lower($1) and u.deleted_at is null`, [email]);
}

export async function getUser(userId: string): Promise<FullUserRow | null> {
  return queryOne<FullUserRow>(`select ${USER_COLUMNS}, u.auth_user_id from public.users u where u.id = $1 and u.deleted_at is null`, [userId]);
}

/** Staff-facing identity: roles with names and the flattened permission list. */
export async function adminIdentity(userId: string) {
  const user = await getUser(userId);
  if (!user) throw unauthorized('Account not found.');
  const roles = await query<{ id: string; slug: string; name: string }>(
    `select r.id, r.slug, r.name from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = $1 and r.is_staff order by r.name`,
    [userId],
  );
  const ctx = await loadAuthContext(userId, 'admin');
  return { user: toPublicUser(user), roles, permissions: [...(ctx?.permissions ?? [])].sort() };
}

export const authService = {
  async register(input: { firstName: string; lastName: string; email: string; phone?: string; password: string; marketingOptIn: boolean }, meta: Meta) {
    if (await findUserByEmail(input.email)) throw conflict('An account with this email already exists.');

    const userId = await withTransaction(async (tx) => {
      const row = await queryOne<{ id: string }>(
        `insert into public.users (first_name, last_name, email, phone, marketing_opt_in)
         values ($1, $2, $3, $4, $5) returning id`,
        [input.firstName, input.lastName, input.email, input.phone || null, input.marketingOptIn],
        tx,
      );
      const id = row!.id;
      const { authUserId } = await credentials.createCredentials({ userId: id, email: input.email, password: input.password, firstName: input.firstName, lastName: input.lastName }, tx);
      const verifiedNow = !env.EMAIL_VERIFICATION_REQUIRED;
      await query(`update public.users set auth_user_id = $2, email_verified_at = case when $3 then now() else null end where id = $1`, [id, authUserId, verifiedNow], tx);
      await query(`insert into public.user_roles (user_id, role_id) select $1, id from public.roles where slug = 'CUSTOMER'`, [id], tx);
      await notificationService.toStaff({ type: 'NEW_CUSTOMER', title: 'New customer registered', message: `${input.firstName} ${input.lastName} created an account.`, link: `/customers/${id}` }, tx);
      return id;
    });

    const user = (await getUser(userId))!;
    if (env.EMAIL_VERIFICATION_REQUIRED) {
      if (credentials.name === 'local') await credentials.sendEmailVerification({ id: userId, email: user.email, firstName: user.first_name, authUserId: user.auth_user_id });
      return { user: toPublicUser(user), session: null as IssuedSession | null, requiresEmailVerification: true };
    }
    emailService.queue('welcome', user.email, { firstName: user.first_name });
    const session = await issueSession(userId, 'customer', meta);
    await query(`update public.users set last_login_at = now() where id = $1`, [userId]);
    return { user: toPublicUser(user), session, requiresEmailVerification: false };
  },

  /** Verifies credentials, account status and — for the admin app — a staff role. */
  async login(emailAddr: string, password: string, scope: TokenScope, meta: Meta) {
    const user = await findUserByEmail(emailAddr);
    // Same message for unknown email and wrong password (no account enumeration).
    const invalid = () => new AppError('UNAUTHORIZED', 'Incorrect email or password.');
    if (!user) throw invalid();
    const okPassword = await credentials.verifyPassword({ id: user.id, authUserId: user.auth_user_id, email: user.email }, password);
    if (!okPassword) throw invalid();
    if (user.status !== 'ACTIVE') throw new AppError('ACCOUNT_INACTIVE', user.status === 'BLOCKED' ? 'This account has been blocked. Please contact SPORTX.' : 'This account is inactive. Please contact SPORTX.');
    if (env.EMAIL_VERIFICATION_REQUIRED && !user.email_verified_at && scope === 'customer') throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address before signing in.');

    const ctx = await loadAuthContext(user.id, scope);
    if (scope === 'admin' && !ctx?.isStaff) throw new AppError('FORBIDDEN', 'This account does not have admin access.');

    const session = await issueSession(user.id, scope, meta);
    await query(`update public.users set last_login_at = now() where id = $1`, [user.id]);
    return { user: toPublicUser(user), session };
  },

  async requestPasswordReset(emailAddr: string, app: 'customer' | 'admin' = 'customer') {
    const user = await findUserByEmail(emailAddr);
    const eligible = user && user.status === 'ACTIVE' && (app === 'customer' || (await loadAuthContext(user.id, 'admin'))?.isStaff);
    await credentials.sendPasswordReset(eligible ? { id: user!.id, email: user!.email, firstName: user!.first_name } : null, emailAddr, { app });
  },

  async resetPassword(token: string, newPassword: string) {
    const userId = await credentials.consumePasswordReset(token);
    const user = await getUser(userId);
    if (!user) throw unauthorized('Account not found.');
    await withTransaction(async (tx) => {
      await credentials.setPassword({ id: user.id, authUserId: user.auth_user_id }, newPassword, tx);
      // A password reset signs the account out everywhere.
      await revokeAllSessions(user.id, undefined, tx);
    });
  },

  async verifyEmail(token: string) {
    const userId = await credentials.consumeEmailVerification(token);
    await query(`update public.users set email_verified_at = coalesce(email_verified_at, now()) where id = $1`, [userId]);
    invalidateAuthContext(userId);
    const user = (await getUser(userId))!;
    emailService.queue('welcome', user.email, { firstName: user.first_name });
    return toPublicUser(user);
  },

  async resendVerification(emailAddr: string) {
    const user = await findUserByEmail(emailAddr);
    if (!user || user.email_verified_at) return;
    await credentials.sendEmailVerification({ id: user.id, email: user.email, firstName: user.first_name, authUserId: user.auth_user_id });
  },
};
