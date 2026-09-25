import type { AppNotification, NotificationPage } from '@/types';
import { api, requestPage } from './api';

type Unread = { unreadCount: number };

/** The signed-in customer's notification centre (`/notifications`). */
export const notificationService = {
  async list(opts: { page?: number; limit?: number; unread?: boolean } = {}, signal?: AbortSignal): Promise<NotificationPage> {
    const res = await requestPage<AppNotification, Unread>('/notifications', {
      query: { page: opts.page ?? 1, limit: opts.limit ?? 20, unread: opts.unread ? true : undefined },
      signal,
    });
    return {
      items: res.data,
      page: res.pagination.page,
      totalPages: res.pagination.totalPages,
      total: res.pagination.total,
      hasNext: res.pagination.hasNext,
      unreadCount: res.unreadCount ?? 0,
    };
  },

  unreadCount: (signal?: AbortSignal) => api.get<Unread>('/notifications/unread-count', undefined, signal).then((r) => r.unreadCount),

  markRead: (id: string) => api.patch<{ notification: AppNotification } & Unread>(`/notifications/${id}/read`),

  markUnread: (id: string) => api.patch<{ notification: AppNotification } & Unread>(`/notifications/${id}/unread`),

  markAllRead: () => api.patch<{ updated: number } & Unread>('/notifications/read-all'),

  remove: (id: string) => api.delete<Unread>(`/notifications/${id}`),

  removeMany: (ids: string[]) => api.post<{ deleted: number } & Unread>('/notifications/delete', { ids }),
};
