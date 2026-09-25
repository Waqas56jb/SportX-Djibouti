import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/constants/storage';
import { authService } from '@/services/authService';
import type { AuthSession, LoginPayload, RegisterPayload, User } from '@/types';

interface AuthState {
  session: AuthSession | null;
  /** Mirrors "Remember me": remembered sessions go to localStorage, others to sessionStorage. */
  remember: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

/**
 * Storage that routes to localStorage or sessionStorage depending on the
 * persisted `remember` flag, so non-remembered sessions end with the tab.
 */
const authStorage = createJSONStorage<Pick<AuthState, 'session' | 'remember'>>(() => ({
  getItem: (name) => localStorage.getItem(name) ?? sessionStorage.getItem(name),
  setItem: (name, value) => {
    const remember = (JSON.parse(value) as { state?: { remember?: boolean } }).state?.remember ?? true;
    (remember ? localStorage : sessionStorage).setItem(name, value);
    (remember ? sessionStorage : localStorage).removeItem(name);
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
}));

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      remember: true,
      login: async (payload) => {
        const session = await authService.login(payload);
        set({ session, remember: payload.remember });
        return session.user;
      },
      register: async (payload) => {
        const session = await authService.register(payload);
        set({ session, remember: true });
        return session.user;
      },
      logout: async () => {
        await authService.logout().catch(() => undefined);
        set({ session: null });
      },
      setUser: (user) => {
        const session = get().session;
        if (session) set({ session: { ...session, user } });
      },
    }),
    {
      name: STORAGE_KEYS.auth,
      version: 1,
      storage: authStorage,
      partialize: (s) => ({ session: s.session, remember: s.remember }),
      onRehydrateStorage: () => (state) => {
        // Drop expired sessions on load.
        if (state?.session && new Date(state.session.expiresAt).getTime() < Date.now()) {
          state.session = null;
        }
      },
    },
  ),
);
