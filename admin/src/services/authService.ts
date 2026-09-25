import type { AdminUser, AuthSession, LoginCredentials } from '@/types';
import { appConfig } from '@/constants/config';
import { DEMO_PASSWORD } from '@/data/people';
import { api, ApiError } from './http';
import { audit, db, delay, setActor } from './mock/db';

const SESSION_HOURS = 12;

export const authService = {
  /** POST /auth/login */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    if (!appConfig.useMocks) return api.post<AuthSession>('/auth/login', credentials);
    await delay(null, 700);
    const user = db.adminUsers.find((u) => u.email.toLowerCase() === credentials.email.trim().toLowerCase());
    if (!user || credentials.password !== DEMO_PASSWORD) {
      if (user) {
        setActor(user);
        audit('Admin sign-in failed', 'Auth', user.email, undefined, 'failed');
        setActor(null);
      }
      throw new ApiError('Invalid email or password.', 401, 'invalid_credentials');
    }
    if (user.status !== 'active') {
      throw new ApiError(user.status === 'invited' ? 'This account has not been activated yet. Check your invitation email.' : 'This account has been deactivated. Contact a Super Admin.', 403, 'account_inactive');
    }
    const role = db.roles.find((r) => r.id === user.roleId)!;
    user.lastLoginAt = new Date().toISOString();
    setActor(user);
    audit('Admin signed in', 'Auth', user.email);
    return structuredClone({
      user,
      role,
      token: `mock_${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString(),
    });
  },

  /** POST /auth/logout */
  async logout(): Promise<void> {
    if (!appConfig.useMocks) return api.post('/auth/logout');
    await delay(null, 150);
    setActor(null);
  },

  /** GET /auth/me — refreshes the role so permission changes apply without re-login. */
  async refreshSession(session: AuthSession): Promise<AuthSession> {
    if (!appConfig.useMocks) return api.get<AuthSession>('/auth/me');
    const user = db.adminUsers.find((u) => u.id === session.user.id);
    const role = user && db.roles.find((r) => r.id === user.roleId);
    if (!user || !role || user.status !== 'active') throw new ApiError('Session expired.', 401);
    setActor(user);
    return structuredClone({ ...session, user, role });
  },

  /** POST /auth/forgot-password — always resolves to avoid account enumeration. */
  async requestPasswordReset(email: string): Promise<void> {
    if (!appConfig.useMocks) return api.post('/auth/forgot-password', { email });
    await delay(null, 800);
  },

  /** PATCH /auth/me */
  async updateProfile(userId: string, patch: Pick<AdminUser, 'name' | 'email' | 'phone' | 'avatarUrl'>): Promise<AdminUser> {
    if (!appConfig.useMocks) return api.patch<AdminUser>('/auth/me', patch);
    const user = db.adminUsers.find((u) => u.id === userId);
    if (!user) throw new ApiError('User not found.', 404);
    Object.assign(user, patch);
    audit('Profile updated', 'Settings', user.name);
    return delay(user);
  },

  /** POST /auth/change-password */
  async changePassword(current: string, next: string): Promise<void> {
    if (!appConfig.useMocks) return api.post('/auth/change-password', { current, next });
    await delay(null, 600);
    if (current !== DEMO_PASSWORD) throw new ApiError('Current password is incorrect.', 400, 'invalid_password');
    audit('Password changed', 'Auth', 'Own account');
  },
};
