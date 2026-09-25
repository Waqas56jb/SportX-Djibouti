import { create } from 'zustand';
import type { AdminNotification } from '@/types';
import { notificationService } from '@/services/notificationService';
import { reportService } from '@/services/reportService';
import type { NavBadgeKey } from '@/constants/navigation';

/** Most recent notifications kept in memory for the topbar popover. */
const RECENT_LIMIT = 20;

interface NotificationState {
  /** Most recent notifications (first page) — the full list is paginated on the Notifications page. */
  items: AdminNotification[];
  /** Centre-wide unread count from the server (not just the loaded page). */
  unreadCount: number;
  loaded: boolean;
  loading: boolean;
  error: boolean;
  navCounts: Partial<Record<NavBadgeKey, number>>;
  load: () => Promise<void>;
  refreshCounts: () => Promise<void>;
  setRead: (ids: string[], read: boolean) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (ids: string[]) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => {
  const setUnread = (n: number) => set((s) => ({ unreadCount: n, navCounts: { ...s.navCounts, notifications: n } }));

  return {
    items: [],
    unreadCount: 0,
    loaded: false,
    loading: false,
    error: false,
    navCounts: {},

    async load() {
      set({ loading: true, error: false });
      try {
        const res = await notificationService.list({ pageSize: RECENT_LIMIT });
        set({ items: res.data, loaded: true, loading: false });
        setUnread(res.unreadCount);
      } catch {
        set({ loading: false, error: true });
      }
    },

    async refreshCounts() {
      const [nav, unread] = await Promise.allSettled([reportService.getNavCounts(), notificationService.unreadCount()]);
      if (nav.status === 'fulfilled') set((s) => ({ navCounts: { ...s.navCounts, ...nav.value } }));
      if (unread.status === 'fulfilled') {
        // New alerts arrived since the last load — refresh the popover list quietly.
        const grew = unread.value > get().unreadCount;
        setUnread(unread.value);
        if (grew && get().loaded && !get().loading) void get().load();
      }
    },

    async setRead(ids, read) {
      const prev = get().items;
      const prevUnread = get().unreadCount;
      const changed = prev.filter((n) => ids.includes(n.id) && n.read !== read).length;
      set({ items: prev.map((n) => (ids.includes(n.id) ? { ...n, read } : n)) });
      setUnread(Math.max(0, prevUnread + (read ? -changed : changed)));
      try {
        setUnread(await notificationService.setRead(ids, read));
      } catch {
        set({ items: prev });
        setUnread(prevUnread);
        throw new Error('Could not update notifications.');
      }
    },

    async markAllRead() {
      const prev = get().items;
      const prevUnread = get().unreadCount;
      set({ items: prev.map((n) => ({ ...n, read: true })) });
      setUnread(0);
      try {
        await notificationService.markAllRead();
      } catch (e) {
        set({ items: prev });
        setUnread(prevUnread);
        throw e;
      }
    },

    async remove(ids) {
      const prev = get().items;
      const prevUnread = get().unreadCount;
      const removedUnread = prev.filter((n) => ids.includes(n.id) && !n.read).length;
      set({ items: prev.filter((n) => !ids.includes(n.id)) });
      setUnread(Math.max(0, prevUnread - removedUnread));
      try {
        await notificationService.remove(ids);
        // Keep the popover full and the count exact after deleting.
        void get().refreshCounts();
        if (get().items.length < RECENT_LIMIT) void get().load();
      } catch (e) {
        set({ items: prev });
        setUnread(prevUnread);
        throw e;
      }
    },
  };
});
