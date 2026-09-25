import type { AdminNotification, NotificationType, Paginated } from '@/types';
import { adminApi } from './api';

interface NotificationDto {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  data: Record<string, unknown>;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

/** Server links carry API enum values (e.g. `/reviews?status=PENDING`); admin pages use lower-case filter values. */
const normalizeLink = (link: string | null) => link?.replace(/([?&][a-z_]+=)([A-Z][A-Z_]*)(?=&|$)/g, (_m, key: string, value: string) => key + value.toLowerCase()) ?? undefined;

const map = (n: NotificationDto): AdminNotification => ({
  id: n.id,
  type: n.type.toLowerCase() as NotificationType,
  title: n.title,
  message: n.message,
  link: normalizeLink(n.link),
  read: n.read,
  createdAt: n.createdAt,
});

export interface NotificationListParams {
  page?: number;
  pageSize?: number;
  unread?: boolean;
  type?: NotificationType | '';
}

/** Shared staff notification centre — /api/v1/admin/notifications. */
export const notificationService = {
  /** GET /admin/notifications — newest first, with the centre-wide unread count. */
  async list(params: NotificationListParams = {}): Promise<Paginated<AdminNotification> & { unreadCount: number }> {
    const res = await adminApi.page<NotificationDto, { unreadCount: number }>('/notifications', {
      page: params.page ?? 1,
      limit: params.pageSize ?? 20,
      unread: params.unread ? true : undefined,
      type: params.type ? params.type.toUpperCase() : undefined,
    });
    return { data: res.data.map(map), total: res.pagination.total, page: res.pagination.page, pageSize: res.pagination.limit, unreadCount: res.unreadCount ?? 0 };
  },

  /** GET /admin/notifications/unread-count */
  async unreadCount(): Promise<number> {
    return (await adminApi.get<{ unreadCount: number }>('/notifications/unread-count')).unreadCount;
  },

  /** PATCH /admin/notifications { ids, read } → new unread count */
  async setRead(ids: string[], read: boolean): Promise<number> {
    return (await adminApi.patch<{ unreadCount: number }>('/notifications', { ids, read })).unreadCount;
  },

  /** POST /admin/notifications/read-all */
  async markAllRead(): Promise<void> {
    await adminApi.post('/notifications/read-all');
  },

  /** POST /admin/notifications/delete { ids } */
  async remove(ids: string[]): Promise<void> {
    await adminApi.post('/notifications/delete', { ids });
  },
};
