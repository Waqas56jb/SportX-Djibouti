import { create } from 'zustand';
import type { AuthSession, LoginCredentials, PermissionKey } from '@/types';
import { authService } from '@/services/authService';
import { setSessionExpiredHandler, tokenStore } from '@/services/api';

/**
 * Admin session.
 * - The access token lives in memory only (services/api `tokenStore`); nothing is persisted to storage.
 * - The refresh token is an HttpOnly cookie set by the API; on app load `restore()` exchanges it
 *   (POST /admin/auth/refresh) for a new access token + identity before protected routes render.
 * - "Remember me" is forwarded to the API, which decides the refresh cookie lifetime.
 */
interface AuthState {
  session: AuthSession | null;
  status: 'idle' | 'checking' | 'authenticated' | 'anonymous';
  /** Message shown on the login page after a forced sign-out (e.g. session expired). */
  notice: string | null;
  restore: (opts?: { silent?: boolean }) => Promise<void>;
  login: (c: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  /** Clears the local session without calling the API (refresh already failed). */
  expire: (message?: string) => void;
  clearNotice: () => void;
  updateSession: (patch: Partial<AuthSession>) => void;
  hasPermission: (key: PermissionKey | PermissionKey[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  status: 'idle',
  notice: null,

  async restore(opts) {
    const current = get().session;
    // Silent refresh keeps the current screen mounted (used after role/permission edits).
    if (current && opts?.silent) {
      try {
        const fresh = await authService.refreshSession(current);
        set({ session: fresh, status: 'authenticated' });
      } catch {
        /* keep the current session; a real expiry is handled by the session-expired handler */
      }
      return;
    }
    if (!opts?.silent) set({ status: 'checking' });
    try {
      const fresh = await authService.restoreSession();
      set(fresh ? { session: fresh, status: 'authenticated' } : { session: null, status: 'anonymous' });
    } catch {
      tokenStore.set(null);
      set({ session: null, status: 'anonymous' });
    }
  },

  async login(c) {
    const session = await authService.login(c);
    set({ session, status: 'authenticated', notice: null });
  },

  async logout() {
    await authService.logout().catch(() => undefined);
    set({ session: null, status: 'anonymous' });
  },

  expire(message = 'Your session has expired. Please sign in again.') {
    if (get().status !== 'authenticated') return;
    tokenStore.set(null);
    set({ session: null, status: 'anonymous', notice: message });
  },

  clearNotice() {
    set({ notice: null });
  },

  updateSession(patch) {
    const cur = get().session;
    if (!cur) return;
    set({ session: { ...cur, ...patch } });
  },

  hasPermission(key) {
    const perms = get().session?.role.permissions ?? [];
    const keys = Array.isArray(key) ? key : [key];
    return keys.every((k) => perms.includes(k));
  },
}));

// A 401 that the refresh cookie cannot fix → drop the session; ProtectedRoute redirects to /login.
setSessionExpiredHandler(() => useAuthStore.getState().expire());
