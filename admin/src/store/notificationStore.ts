import { create } from 'zustand';
import type { AdminNotification } from '@/types';
import { notificationService } from '@/services/notificationService';
import { reportService } from '@/services/reportService';
import type { NavBadgeKey } from '@/constants/navigation';

interface NotificationState {
  items: AdminNotification[];
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

const unread = (items: AdminNotification[]) => items.filter((n) => !n.read).length;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  loaded: false,
  loading: false,
  error: false,
  navCounts: {},

  async load() {
    set({ loading: true, error: false });
    try {
      const items = await notificationService.getNotifications();
      set((s) => ({ items, loaded: true, loading: false, navCounts: { ...s.navCounts, notifications: unread(items) } }));
    } catch {
      set({ loading: false, error: true });
    }
  },

  async refreshCounts() {
    try {
      const c = await reportService.getNavCounts();
      set((s) => ({ navCounts: { ...s.navCounts, ...c } }));
    } catch {
      /* badges are non-critical */
    }
  },

  async setRead(ids, read) {
    const prev = get().items;
    const items = prev.map((n) => (ids.includes(n.id) ? { ...n, read } : n));
    set((s) => ({ items, navCounts: { ...s.navCounts, notifications: unread(items) } }));
    try {
      await notificationService.setRead(ids, read);
    } catch {
      set((s) => ({ items: prev, navCounts: { ...s.navCounts, notifications: unread(prev) } }));
      throw new Error('Could not update notifications.');
    }
  },

  async markAllRead() {
    const items = get().items.map((n) => ({ ...n, read: true }));
    set((s) => ({ items, navCounts: { ...s.navCounts, notifications: 0 } }));
    await notificationService.markAllRead();
  },

  async remove(ids) {
    const items = get().items.filter((n) => !ids.includes(n.id));
    set((s) => ({ items, navCounts: { ...s.navCounts, notifications: unread(items) } }));
    await notificationService.remove(ids);
  },
}));
