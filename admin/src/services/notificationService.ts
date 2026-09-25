import type { AdminNotification } from '@/types';
import { appConfig } from '@/constants/config';
import { api } from './http';
import { db, delay } from './mock/db';

export const notificationService = {
  /** GET /notifications */
  async getNotifications(): Promise<AdminNotification[]> {
    if (!appConfig.useMocks) return api.get<AdminNotification[]>('/notifications');
    return delay([...db.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), 250);
  },

  /** PATCH /notifications { ids, read } */
  async setRead(ids: string[], read: boolean): Promise<void> {
    if (!appConfig.useMocks) return api.patch('/notifications', { ids, read });
    for (const n of db.notifications) if (ids.includes(n.id)) n.read = read;
    await delay(null, 120);
  },

  /** POST /notifications/read-all */
  async markAllRead(): Promise<void> {
    if (!appConfig.useMocks) return api.post('/notifications/read-all');
    for (const n of db.notifications) n.read = true;
    await delay(null, 120);
  },

  /** DELETE /notifications { ids } */
  async remove(ids: string[]): Promise<void> {
    if (!appConfig.useMocks) return api.post('/notifications/delete', { ids });
    db.notifications = db.notifications.filter((n) => !ids.includes(n.id));
    await delay(null, 120);
  },
};
