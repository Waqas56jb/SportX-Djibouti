import type { AuthSession, LoginPayload, RegisterPayload, User } from '@/types';
import { uid } from '@/utils/id';
import { apiClient } from './api/client';
import { USE_MOCK_API } from './config';
import { MockError, db, delay } from './mock/db';

const toSession = (user: User, remember: boolean): AuthSession => ({
  user,
  token: `mock.${btoa(user.id)}.${Date.now().toString(36)}`,
  expiresAt: new Date(Date.now() + (remember ? 30 : 1) * 86400000).toISOString(),
});

const stripPassword = ({ password: _password, ...user }: User & { password: string }): User => user;

export const authService = {
  async login(payload: LoginPayload): Promise<AuthSession> {
    if (!USE_MOCK_API) return apiClient.post<AuthSession>('/auth/login', payload);
    await delay(500, 900);
    const record = db.read().users.find((u) => u.email.toLowerCase() === payload.email.trim().toLowerCase());
    if (!record || record.password !== payload.password) throw new MockError('Incorrect email or password.', 401);
    return toSession(stripPassword(record), payload.remember);
  },

  async register(payload: RegisterPayload): Promise<AuthSession> {
    if (!USE_MOCK_API) return apiClient.post<AuthSession>('/auth/register', payload);
    await delay(600, 1000);
    const email = payload.email.trim().toLowerCase();
    if (db.read().users.some((u) => u.email.toLowerCase() === email)) {
      throw new MockError('An account with this email already exists.', 409);
    }
    const user: User = {
      id: uid('usr'),
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      email,
      phone: payload.phone.trim(),
      createdAt: new Date().toISOString(),
      marketingOptIn: false,
    };
    db.write((d) => {
      d.users.push({ ...user, password: payload.password });
    });
    return toSession(user, true);
  },

  async logout(): Promise<void> {
    if (!USE_MOCK_API) return apiClient.post<void>('/auth/logout');
    await delay(100, 200);
  },

  async requestPasswordReset(email: string): Promise<void> {
    if (!USE_MOCK_API) return apiClient.post<void>('/auth/forgot-password', { email });
    // Always succeed so the UI never reveals whether an email is registered.
    await delay(600, 900);
  },

  async resetPassword(token: string, password: string): Promise<void> {
    if (!USE_MOCK_API) return apiClient.post<void>('/auth/reset-password', { token, password });
    await delay(600, 900);
    if (!token) throw new MockError('This reset link is invalid or has expired.', 400);
  },

  async updateProfile(userId: string, patch: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    if (!USE_MOCK_API) return apiClient.patch<User>('/me', patch);
    await delay(400, 700);
    const email = patch.email?.trim().toLowerCase();
    if (email && db.read().users.some((u) => u.id !== userId && u.email.toLowerCase() === email)) {
      throw new MockError('That email is already in use.', 409);
    }
    let updated: User | undefined;
    db.write((d) => {
      const u = d.users.find((x) => x.id === userId);
      if (!u) return;
      Object.assign(u, patch, email ? { email } : {});
      updated = stripPassword(u);
    });
    if (!updated) throw new MockError('Account not found.', 404);
    return updated;
  },

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    if (!USE_MOCK_API) return apiClient.post<void>('/me/password', { current, next });
    await delay(500, 800);
    const record = db.read().users.find((u) => u.id === userId);
    if (!record || record.password !== current) throw new MockError('Your current password is incorrect.', 400);
    db.write((d) => {
      const u = d.users.find((x) => x.id === userId);
      if (u) u.password = next;
    });
  },
};
