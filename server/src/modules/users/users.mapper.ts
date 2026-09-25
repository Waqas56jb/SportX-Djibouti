export interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  marketing_opt_in: boolean;
  email_verified_at: string | Date | null;
  last_login_at: string | Date | null;
  created_at: string | Date;
}

export const USER_COLUMNS = `u.id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.status, u.marketing_opt_in,
  u.email_verified_at, u.last_login_at, u.created_at`;

const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null);

/** Public profile. Never includes credentials, auth ids or internal notes. */
export function toPublicUser(u: UserRow) {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    email: u.email,
    phone: u.phone ?? '',
    avatarUrl: u.avatar_url,
    status: u.status,
    marketingOptIn: u.marketing_opt_in,
    emailVerified: Boolean(u.email_verified_at),
    lastLoginAt: iso(u.last_login_at),
    createdAt: iso(u.created_at)!,
  };
}
export type PublicUser = ReturnType<typeof toPublicUser>;
