import { create } from 'zustand';
import type { AuthSession, LoginCredentials, PermissionKey } from '@/types';
import { authService } from '@/services/authService';
import { setActor } from '@/services/mock/db';
import { setTokenGetter } from '@/services/http';

const KEY = 'sportx-admin-session';

/**
 * Only the opaque token + non-sensitive profile are persisted. "Remember me" uses localStorage,
 * otherwise sessionStorage (cleared when the browser closes). With the real backend, prefer an
 * httpOnly refresh cookie and keep the access token in memory.
 */
function readStored(): AuthSession | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(KEY);
      if (!raw) continue;
      const s = JSON.parse(raw) as AuthSession;
      if (new Date(s.expiresAt).getTime() > Date.now()) return s;
      store.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
  }
  return null;
}

function persist(session: AuthSession | null, remember = false) {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    if (session) (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable */
  }
}

interface AuthState {
  session: AuthSession | null;
  status: 'idle' | 'checking' | 'authenticated' | 'anonymous';
  restore: (opts?: { silent?: boolean }) => Promise<void>;
  login: (c: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateSession: (patch: Partial<AuthSession>) => void;
  hasPermission: (key: PermissionKey | PermissionKey[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  status: 'idle',

  async restore(opts) {
    const stored = get().session ?? readStored();
    if (!stored) return set({ status: 'anonymous' });
    // Silent refresh keeps the current screen mounted (used after role/permission edits).
    if (!opts?.silent) set({ status: 'checking' });
    try {
      const fresh = await authService.refreshSession(stored);
      const remembered = (() => {
        try {
          return Boolean(localStorage.getItem(KEY));
        } catch {
          return false;
        }
      })();
      persist(fresh, remembered);
      setActor(fresh.user);
      set({ session: fresh, status: 'authenticated' });
    } catch {
      persist(null);
      set({ session: null, status: 'anonymous' });
    }
  },

  async login(c) {
    const session = await authService.login(c);
    persist(session, c.remember);
    setActor(session.user);
    set({ session, status: 'authenticated' });
  },

  async logout() {
    await authService.logout().catch(() => undefined);
    persist(null);
    setActor(null);
    set({ session: null, status: 'anonymous' });
  },

  updateSession(patch) {
    const cur = get().session;
    if (!cur) return;
    const next = { ...cur, ...patch };
    let remembered = false;
    try {
      remembered = Boolean(localStorage.getItem(KEY));
    } catch {
      /* ignore */
    }
    persist(next, remembered);
    set({ session: next });
  },

  hasPermission(key) {
    const perms = get().session?.role.permissions ?? [];
    const keys = Array.isArray(key) ? key : [key];
    return keys.every((k) => perms.includes(k));
  },
}));

setTokenGetter(() => useAuthStore.getState().session?.token ?? null);
