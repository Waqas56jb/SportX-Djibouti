import { queryOne } from '../../config/database.js';
import type { AuthContext } from '../../types/auth.js';

interface Row {
  id: string;
  auth_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  status: AuthContext['status'];
  email_verified_at: string | null;
  roles: string[] | null;
  permissions: string[] | null;
  is_staff: boolean | null;
}

// Tiny TTL cache so every request does not re-read roles. Invalidate on role/status change.
const CACHE_MS = 15_000;
const cache = new Map<string, { at: number; value: Omit<AuthContext, 'scope'> }>();

export function invalidateAuthContext(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

/** Loads identity, roles and permissions for a user id taken from a verified token. */
export async function loadAuthContext(userId: string, scope: AuthContext['scope']): Promise<AuthContext | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit.value, scope };

  const row = await queryOne<Row>(
    `select u.id, u.auth_user_id, u.email, u.first_name, u.last_name, u.status, u.email_verified_at,
            array_remove(array_agg(distinct r.slug), null) as roles,
            array_remove(array_agg(distinct rp.permission_key), null) as permissions,
            bool_or(r.is_staff) as is_staff
       from public.users u
       left join public.user_roles ur on ur.user_id = u.id
       left join public.roles r on r.id = ur.role_id
       left join public.role_permissions rp on rp.role_id = r.id
      where u.id = $1 and u.deleted_at is null
      group by u.id`,
    [userId],
  );
  if (!row) return null;
  const value: Omit<AuthContext, 'scope'> = {
    userId: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    status: row.status,
    emailVerified: Boolean(row.email_verified_at),
    roles: row.roles ?? [],
    permissions: new Set(row.permissions ?? []),
    isStaff: Boolean(row.is_staff),
  };
  cache.set(userId, { at: Date.now(), value });
  return { ...value, scope };
}
