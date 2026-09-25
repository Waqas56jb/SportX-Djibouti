import { env } from '../../config/env.js';
import { query, queryOne, withTransaction } from '../../config/database.js';
import { AppError, conflict, unauthorized } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { storageService } from '../../services/storage/storage.service.js';
import { credentials } from '../auth/providers/index.js';
import { getUser } from '../auth/auth.service.js';
import { revokeAllSessions } from '../auth/tokens.js';
import { invalidateAuthContext } from '../auth/auth.context.js';
import { toPublicUser } from './users.mapper.js';

/** Orders in these statuses are finished; anything else blocks account deletion. */
const CLOSED_ORDER_STATUSES = ['DELIVERED', 'CANCELLED', 'REFUNDED'];

async function requireUser(userId: string) {
  const user = await getUser(userId);
  if (!user) throw unauthorized('Account not found.');
  return user;
}

async function assertPassword(user: { id: string; auth_user_id: string | null; email: string }, password: string, message = 'Your current password is incorrect.') {
  const valid = await credentials.verifyPassword({ id: user.id, authUserId: user.auth_user_id, email: user.email }, password);
  if (!valid) throw new AppError('VALIDATION_ERROR', message, { fieldErrors: { currentPassword: [message] } });
}

/** Storage key of an avatar we uploaded for this user (users/{id}/…); null for external URLs. */
function avatarPath(url: string | null, userId: string): string | null {
  if (!url) return null;
  const m = url.match(/(users\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+)(?:[?#].*)?$/);
  return m && m[1].startsWith(`users/${userId}/`) ? m[1] : null;
}

export interface UpdateMeInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  marketingOptIn?: boolean;
  email?: string;
  currentPassword?: string;
}

export const usersService = {
  async me(userId: string) {
    return toPublicUser(await requireUser(userId));
  },

  async updateMe(userId: string, input: UpdateMeInput) {
    const user = await requireUser(userId);
    const emailChanged = input.email !== undefined && input.email.toLowerCase() !== user.email.toLowerCase();

    if (emailChanged) {
      if (!input.currentPassword) throw new AppError('VALIDATION_ERROR', 'Enter your current password to change your email address.', { fieldErrors: { currentPassword: ['Required to change your email address.'] } });
      await assertPassword(user, input.currentPassword);
      const taken = await queryOne(`select 1 from public.users where lower(email) = lower($1) and deleted_at is null and id <> $2`, [input.email, userId]);
      if (taken) throw conflict('Another account already uses this email.');
      await credentials.updateEmail({ id: user.id, authUserId: user.auth_user_id }, input.email!);
    }

    const sets: string[] = [];
    const params: unknown[] = [userId];
    const set = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (input.firstName !== undefined) set('first_name', input.firstName);
    if (input.lastName !== undefined) set('last_name', input.lastName);
    if (input.phone !== undefined) set('phone', input.phone || null);
    if (input.marketingOptIn !== undefined) set('marketing_opt_in', input.marketingOptIn);
    if (emailChanged) {
      set('email', input.email);
      if (env.EMAIL_VERIFICATION_REQUIRED) sets.push('email_verified_at = null');
    }
    if (sets.length) {
      try {
        await query(`update public.users set ${sets.join(', ')} where id = $1 and deleted_at is null`, params);
      } catch (err) {
        if ((err as { code?: string }).code === '23505') throw conflict('Another account already uses this email.');
        throw err;
      }
      invalidateAuthContext(userId);
    }

    const updated = await requireUser(userId);
    if (emailChanged && env.EMAIL_VERIFICATION_REQUIRED && credentials.name === 'local') {
      await credentials.sendEmailVerification({ id: updated.id, email: updated.email, firstName: updated.first_name, authUserId: updated.auth_user_id });
    }
    return toPublicUser(updated);
  },

  async setAvatar(userId: string, file: { buffer: Buffer; mimetype: string; size: number }) {
    const user = await requireUser(userId);
    const stored = await storageService.putImage('users', userId, file);
    await query(`update public.users set avatar_url = $2 where id = $1`, [userId, stored.url]);
    await storageService.remove(avatarPath(user.avatar_url, userId));
    return toPublicUser(await requireUser(userId));
  },

  async removeAvatar(userId: string) {
    const user = await requireUser(userId);
    if (user.avatar_url) {
      await query(`update public.users set avatar_url = null where id = $1`, [userId]);
      await storageService.remove(avatarPath(user.avatar_url, userId));
    }
    return toPublicUser(await requireUser(userId));
  },

  /** Verifies the current password, sets the new one and signs out every other session (the caller's refresh session is kept). */
  async changePassword(userId: string, currentPassword: string, newPassword: string, keepRefreshToken?: string) {
    const user = await requireUser(userId);
    await assertPassword(user, currentPassword);
    await withTransaction(async (tx) => {
      await credentials.setPassword({ id: user.id, authUserId: user.auth_user_id }, newPassword, tx);
      await revokeAllSessions(user.id, keepRefreshToken, tx);
    });
  },

  /**
   * Customer-initiated account deletion. The profile is anonymised and soft-deleted; orders are kept
   * (accounting), personal data that has no accounting purpose (addresses, cart, wishlist) is removed.
   */
  async deleteMe(userId: string, password: string) {
    const user = await requireUser(userId);
    await assertPassword(user, password, 'Your password is incorrect.');

    await withTransaction(async (tx) => {
      await query(`select id from public.users where id = $1 for update`, [userId], tx);
      const open = await queryOne<{ n: number }>(
        `select count(*)::int as n from public.orders where user_id = $1 and deleted_at is null and status <> all($2::public.order_status[])`,
        [userId, CLOSED_ORDER_STATUSES],
        tx,
      );
      if ((open?.n ?? 0) > 0) throw conflict('You have orders in progress. Your account can be deleted once they are delivered or cancelled.', { openOrders: open!.n });

      await query(
        `update public.users set
           email = 'deleted-' || id::text || '@deleted.invalid', first_name = 'Deleted', last_name = 'Deleted',
           phone = null, avatar_url = null, marketing_opt_in = false, status = 'INACTIVE', deleted_at = now()
         where id = $1`,
        [userId],
        tx,
      );
      await query(`delete from public.addresses where user_id = $1`, [userId], tx);
      await query(`delete from public.carts where user_id = $1`, [userId], tx);
      await query(`delete from public.wishlists where user_id = $1`, [userId], tx);
      await query(`delete from public.newsletter_subscribers where lower(email) = lower($1)`, [user.email], tx);
      await query(`delete from public.auth_tokens where user_id = $1`, [userId], tx);
      await revokeAllSessions(userId, undefined, tx);
    });
    invalidateAuthContext(userId);

    // External credential stores run after commit (never inside the transaction).
    try {
      await credentials.deleteCredentials({ id: user.id, authUserId: user.auth_user_id });
    } catch (err) {
      logger.warn({ err, userId }, 'credential deletion failed after account deletion');
    }
    await storageService.remove(avatarPath(user.avatar_url, userId));
  },
};
