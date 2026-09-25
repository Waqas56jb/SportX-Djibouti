import { query, queryOne, withTransaction } from '../../config/database.js';
import { conflict, notFound } from '../../utils/errors.js';
import { credentials } from './providers/index.js';
import { invalidateAuthContext } from './auth.context.js';

/**
 * Creates (or promotes) an account with credentials and a role. Used by the admin "invite admin"
 * flow, the create-admin CLI and the seed. Passwords always come from the caller — never defaults.
 */
export async function provisionUser(input: { email: string; password: string; firstName: string; lastName: string; phone?: string | null; roleSlug: string; verified?: boolean }) {
  const role = await queryOne<{ id: string }>(`select id from public.roles where slug = $1`, [input.roleSlug]);
  if (!role) throw notFound('Role');
  const existing = await queryOne<{ id: string }>(`select id from public.users where lower(email) = lower($1) and deleted_at is null`, [input.email]);
  if (existing) {
    const has = await queryOne(`select 1 from public.user_roles where user_id = $1 and role_id = $2`, [existing.id, role.id]);
    if (has) throw conflict('An account with this email already has this role.');
    await query(`insert into public.user_roles (user_id, role_id) values ($1, $2)`, [existing.id, role.id]);
    invalidateAuthContext(existing.id);
    return { userId: existing.id, created: false };
  }
  const userId = await withTransaction(async (tx) => {
    const u = await queryOne<{ id: string }>(
      `insert into public.users (first_name, last_name, email, phone, email_verified_at) values ($1, $2, $3, $4, case when $5 then now() else null end) returning id`,
      [input.firstName, input.lastName, input.email.toLowerCase(), input.phone ?? null, input.verified ?? true],
      tx,
    );
    const { authUserId } = await credentials.createCredentials({ userId: u!.id, email: input.email.toLowerCase(), password: input.password, firstName: input.firstName, lastName: input.lastName }, tx);
    if (authUserId) await query(`update public.users set auth_user_id = $2 where id = $1`, [u!.id, authUserId], tx);
    await query(`insert into public.user_roles (user_id, role_id) values ($1, $2)`, [u!.id, role.id], tx);
    return u!.id;
  });
  return { userId, created: true };
}
