import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useWishlistStore } from '@/store/wishlistStore';

const UNREAD_POLL_MS = 60_000;

/**
 * Account side-effects that follow the signed-in user:
 * - wishlist: merges the on-device list into the account once per sign-in, back to guest on sign-out;
 * - notifications: refreshes the unread badge on route changes (throttled) and every 60s while visible.
 */
export function WishlistSync() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const refreshUnread = useAuthStore((s) => s.refreshUnread);
  const attached = useRef<string | null>(null);
  const lastPoll = useRef(0);
  const location = useLocation();

  useEffect(() => {
    const store = useWishlistStore.getState();
    if (!userId) {
      if (attached.current || store.mode === 'account') store.detachAccount();
      attached.current = null;
      return;
    }
    if (attached.current === userId) return;
    attached.current = userId;
    void store.attachAccount();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      lastPoll.current = Date.now();
      void refreshUnread();
    };
    const timer = window.setInterval(poll, UNREAD_POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [userId, refreshUnread]);

  useEffect(() => {
    if (!userId || Date.now() - lastPoll.current < 15_000) return;
    lastPoll.current = Date.now();
    void refreshUnread();
  }, [location.pathname, userId, refreshUnread]);

  return null;
}
