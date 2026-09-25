import type { AdminStatus, AdminUser, AuthSession, LoginCredentials, PermissionKey, Role } from '@/types';
import { adminApi, ApiError, refreshSession as refreshApiSession, request, tokenStore, type AdminSessionPayload } from './api';

/** Staff identity as returned by the API (toPublicUser). */
interface ApiUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status: string;
  lastLoginAt?: string | null;
  createdAt: string;
}

interface Identity {
  user: ApiUser;
  roles: { id: string; slug: string; name: string }[];
  permissions: string[];
}

const ROLE_PRIORITY = ['SUPER_ADMIN', 'STORE_MANAGER'];

function toStatus(s: string): AdminStatus {
  return s === 'ACTIVE' ? 'active' : 'deactivated';
}

/** Maps the API identity ({ user, roles, permissions }) onto the admin's session shape. */
export function toSession(identity: Identity, expiresAt: string): AuthSession {
  const roles = identity.roles ?? [];
  const primary = [...roles].sort((a, b) => {
    const ia = ROLE_PRIORITY.indexOf(a.slug);
    const ib = ROLE_PRIORITY.indexOf(b.slug);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  })[0];
  const u = identity.user;
  const user: AdminUser = {
    id: u.id,
    name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
    email: u.email,
    phone: u.phone || undefined,
    avatarUrl: u.avatarUrl || undefined,
    roleId: primary?.id ?? '',
    roleName: roles.map((r) => r.name).join(', ') || 'Staff',
    status: toStatus(u.status),
    lastLoginAt: u.lastLoginAt ?? undefined,
    createdAt: u.createdAt,
  };
  const role: Role = {
    id: primary?.id ?? '',
    slug: (primary?.slug ?? 'staff').toLowerCase(),
    name: roles.length > 1 ? roles.map((r) => r.name).join(' + ') : primary?.name ?? 'Staff',
    description: roles.length > 1 ? `Combined access from ${roles.length} roles.` : '',
    permissions: identity.permissions as PermissionKey[],
    isSystem: true,
    userCount: 0,
    updatedAt: new Date().toISOString(),
  };
  return { user, role, roles, expiresAt };
}

/** Human messages for the admin sign-in error codes. */
export function loginErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Unable to sign in. Please try again.';
  switch (err.code) {
    case 'UNAUTHORIZED':
      return 'Incorrect email or password.';
    case 'FORBIDDEN':
      return 'This account does not have access to SPORTX Admin.';
    case 'ACCOUNT_INACTIVE':
      return err.message || 'This account is inactive. Contact a Super Admin.';
    case 'RATE_LIMITED':
      return 'Too many sign-in attempts. Please wait a few minutes and try again.';
    case 'NETWORK_ERROR':
      return err.message;
    case 'VALIDATION_ERROR':
      return 'Enter a valid email address and password.';
    default:
      return err.message || 'Unable to sign in. Please try again.';
  }
}

export const authService = {
  /** POST /admin/auth/login → { user, roles, permissions, accessToken, expiresAt }. Refresh cookie is set by the API. */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const data = await request<AdminSessionPayload & Identity>('/admin/auth/login', {
      method: 'POST',
      body: { email: credentials.email.trim().toLowerCase(), password: credentials.password, remember: credentials.remember },
      noRefresh: true,
    });
    tokenStore.set(data.accessToken, data.expiresAt);
    return toSession(data, data.expiresAt);
  },

  /** POST /admin/auth/logout — revokes the refresh cookie. */
  async logout(): Promise<void> {
    try {
      await request('/admin/auth/logout', { method: 'POST', noRefresh: true });
    } finally {
      tokenStore.set(null);
    }
  },

  /** POST /admin/auth/refresh (cookie) → new access token + identity. Null when there is no session. */
  async restoreSession(): Promise<AuthSession | null> {
    const data = await refreshApiSession();
    if (!data) return null;
    return toSession(data as AdminSessionPayload & Identity, data.expiresAt);
  },

  /** GET /admin/auth/me — re-reads roles/permissions without rotating the token (e.g. after role edits). */
  async refreshSession(session: AuthSession): Promise<AuthSession> {
    const data = await adminApi.get<Identity>('/auth/me');
    return toSession(data, session.expiresAt);
  },

  /** POST /admin/auth/forgot-password — always resolves (no account enumeration). */
  async requestPasswordReset(email: string): Promise<void> {
    await request('/admin/auth/forgot-password', { method: 'POST', body: { email: email.trim().toLowerCase() }, noRefresh: true });
  },

  /** POST /admin/auth/reset-password { token, password } — token comes from the emailed link. */
  async resetPassword(token: string, password: string): Promise<void> {
    await request('/admin/auth/reset-password', { method: 'POST', body: { token, password }, noRefresh: true });
  },

  /** Self-service profile — PATCH /users/me (accepts the admin access token). Prefer profileService. */
  async updateProfile(_userId: string, patch: Pick<AdminUser, 'name' | 'email' | 'phone' | 'avatarUrl'>): Promise<void> {
    const [firstName, ...rest] = patch.name.trim().split(/\s+/);
    await request('/users/me', { method: 'PATCH', body: { firstName, lastName: rest.join(' ') || firstName, phone: patch.phone || undefined } });
  },

  /** PATCH /users/me/password — signs out the admin's other sessions. */
  async changePassword(current: string, next: string): Promise<void> {
    await request('/users/me/password', { method: 'PATCH', body: { currentPassword: current, newPassword: next } });
  },
};
