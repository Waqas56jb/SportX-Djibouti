import type { AdminUser } from '@/types';
import { request } from './api';

/**
 * The signed-in user's own profile — /api/v1/users/me. Works with the admin (staff) access token;
 * identity always comes from the token, never from an id in the URL.
 */

interface MeDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  marketingOptIn: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Profile fields that can be merged into the session's AdminUser. */
export type ProfileUser = Pick<AdminUser, 'id' | 'name' | 'email' | 'phone' | 'avatarUrl' | 'lastLoginAt' | 'createdAt'> & {
  firstName: string;
  lastName: string;
  emailVerified: boolean;
};

export interface ProfileInput {
  name: string;
  email: string;
  phone: string;
  /** Required by the API when the email changes. */
  currentPassword?: string;
}

const toProfile = (u: MeDto): ProfileUser => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName,
  name: `${u.firstName} ${u.lastName}`.trim(),
  email: u.email,
  phone: u.phone || undefined,
  avatarUrl: u.avatarUrl ?? undefined,
  emailVerified: u.emailVerified,
  lastLoginAt: u.lastLoginAt ?? undefined,
  createdAt: u.createdAt,
});

/** "Amina Hassan Ali" → { firstName: "Amina", lastName: "Hassan Ali" }. */
export function splitName(full: string) {
  const [firstName, ...rest] = full.trim().split(/\s+/);
  return { firstName: firstName ?? '', lastName: rest.join(' ') || firstName || '' };
}

export const profileService = {
  /** GET /users/me */
  async me(): Promise<ProfileUser> {
    return toProfile((await request<{ user: MeDto }>('/users/me')).user);
  },

  /** PATCH /users/me — name/phone; email changes need `currentPassword`. */
  async update(input: ProfileInput, current: Pick<AdminUser, 'email'>): Promise<ProfileUser> {
    const emailChanged = input.email.trim().toLowerCase() !== current.email.toLowerCase();
    const body = {
      ...splitName(input.name),
      phone: input.phone.trim() || null,
      ...(emailChanged ? { email: input.email.trim().toLowerCase(), currentPassword: input.currentPassword } : {}),
    };
    return toProfile((await request<{ user: MeDto }>('/users/me', { method: 'PATCH', body })).user);
  },

  /** POST /users/me/avatar (multipart "file"; JPEG/PNG/WebP/AVIF, ≤ 5 MB). */
  async uploadAvatar(file: File): Promise<ProfileUser> {
    const fd = new FormData();
    fd.append('file', file);
    return toProfile((await request<{ user: MeDto }>('/users/me/avatar', { method: 'POST', body: fd })).user);
  },

  /** DELETE /users/me/avatar */
  async removeAvatar(): Promise<ProfileUser> {
    return toProfile((await request<{ user: MeDto }>('/users/me/avatar', { method: 'DELETE' })).user);
  },

  /** PATCH /users/me/password — other devices are signed out; this one stays signed in. */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await request<null>('/users/me/password', { method: 'PATCH', body: { currentPassword, newPassword } });
  },
};
