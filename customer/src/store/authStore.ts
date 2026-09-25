import { create } from 'zustand';
import { STORAGE_KEYS } from '@/constants/storage';
import { consumeRefreshedUser, refreshSession, setSessionExpiredHandler, tokenStore } from '@/services/api';
import { authService } from '@/services/authService';
import { notificationService } from '@/services/notificationService';
import { toast } from './toastStore';
import type { AuthSession, LoginPayload, RegisterPayload, RegisterResult, User } from '@/types';

/**
 * - `restoring`: the app is exchanging the HttpOnly refresh cookie for an access token on load.
 *   Guarded routes wait for this to finish instead of redirecting to /login.
 * - `ready`: the session is known (signed in or not).
 */
export type AuthStatus = 'restoring' | 'ready';

interface AuthState {
  /** `{ user }` while signed in. No token is ever stored here (it stays in memory in services/api). */
  session: AuthSession | null;
  status: AuthStatus;
  unreadNotifications: number;
  /** Restores the session from the refresh cookie. Safe to call more than once. */
  bootstrap: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  /** Local sign-out only (session expired / account deleted). */
  clear: () => void;
  setUser: (user: User) => void;
  refreshUnread: () => Promise<void>;
  setUnread: (n: number) => void;
}

/**
 * Non-secret hint that this browser had a session, so a first-time visitor does not trigger a
 * pointless refresh call. The refresh cookie itself is HttpOnly and never readable here.
 */
const HINT_KEY = `${STORAGE_KEYS.auth}.hint`;
const hint = {
  get: () => {
    try {
      return localStorage.getItem(HINT_KEY) === '1';
    } catch {
      return true;
    }
  },
  set: (on: boolean) => {
    try {
      if (on) localStorage.setItem(HINT_KEY, '1');
      else localStorage.removeItem(HINT_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

// Remove anything an older build persisted (it used to contain the session token).
try {
  localStorage.removeItem(STORAGE_KEYS.auth);
  sessionStorage.removeItem(STORAGE_KEYS.auth);
} catch {
  /* storage unavailable */
}

let bootstrapping: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  status: 'restoring',
  unreadNotifications: 0,

  bootstrap: () => {
    bootstrapping ??= (async () => {
      try {
        if (!hint.get()) return;
        const token = await refreshSession();
        if (!token) {
          hint.set(false);
          return;
        }
        const user = (consumeRefreshedUser() as User | null) ?? (await authService.me());
        set({ session: { user } });
        void get().refreshUnread();
      } catch {
        tokenStore.set(null);
      } finally {
        set({ status: 'ready' });
      }
    })();
    return bootstrapping;
  },

  login: async (payload) => {
    const user = await authService.login(payload);
    hint.set(true);
    set({ session: { user }, status: 'ready' });
    void get().refreshUnread();
    return user;
  },

  register: async (payload) => {
    const result = await authService.register(payload);
    if (!result.requiresEmailVerification) {
      hint.set(true);
      set({ session: { user: result.user }, status: 'ready' });
    }
    return result;
  },

  logout: async () => {
    await authService.logout().catch(() => undefined);
    get().clear();
  },

  clear: () => {
    tokenStore.set(null);
    hint.set(false);
    set({ session: null, unreadNotifications: 0, status: 'ready' });
  },

  setUser: (user) => {
    if (get().session) set({ session: { user } });
  },

  refreshUnread: async () => {
    if (!get().session) return;
    try {
      set({ unreadNotifications: await notificationService.unreadCount() });
    } catch {
      /* non-critical */
    }
  },

  setUnread: (n) => set({ unreadNotifications: Math.max(0, n) }),
}));

/** Called by the API client when the refresh cookie can no longer be exchanged. */
setSessionExpiredHandler(() => {
  if (!useAuthStore.getState().session) return;
  useAuthStore.getState().clear();
  toast.info('Your session has expired', { description: 'Please sign in again to continue.' });
});
