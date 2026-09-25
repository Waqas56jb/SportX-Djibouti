import type { ActivityFilterOptions, ActivityLog } from '@/types';
import { adminApi, type Pagination } from './api';

/** Admin audit trail — /api/v1/admin/activity-logs. */

interface ActivityDto {
  id: string;
  adminId: string | null;
  adminName: string;
  adminEmail: string | null;
  action: string;
  module: string;
  entityType: string;
  entityId: string | null;
  record: string;
  recordLink: string | null;
  metadata: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILED';
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ActivityFilters {
  page?: number;
  limit?: number;
  search?: string;
  adminId?: string;
  /** Entity type, e.g. "order". */
  module?: string;
  action?: string;
  status?: 'success' | 'failed';
  /** ISO timestamp or YYYY-MM-DD (inclusive). */
  from?: string;
  to?: string;
  sort?: 'created_at' | 'action';
  order?: 'asc' | 'desc';
}

const toLog = (d: ActivityDto): ActivityLog => ({
  id: d.id,
  adminId: d.adminId ?? '',
  adminName: d.adminName,
  adminEmail: d.adminEmail ?? undefined,
  action: d.action,
  module: d.module ?? d.entityType,
  record: d.record,
  recordLink: d.recordLink ?? undefined,
  entityId: d.entityId ?? undefined,
  metadata: d.metadata,
  ipAddress: d.ipAddress ?? '',
  userAgent: d.userAgent ?? undefined,
  status: d.status === 'FAILED' ? 'failed' : 'success',
  createdAt: d.createdAt,
});

/** "shipping_zone" → "Shipping zone". */
export const moduleLabel = (m: string) => (m ? (m.charAt(0).toUpperCase() + m.slice(1)).replace(/_/g, ' ') : '—');

export const activityService = {
  /** GET /admin/activity-logs — server-side filters, sort and pagination. */
  async list(f: ActivityFilters = {}): Promise<{ data: ActivityLog[]; pagination: Pagination }> {
    const res = await adminApi.page<ActivityDto>('/activity-logs', {
      page: f.page,
      limit: f.limit,
      search: f.search?.trim() || undefined,
      admin: f.adminId || undefined,
      module: f.module || undefined,
      action: f.action || undefined,
      status: f.status ? f.status.toUpperCase() : undefined,
      from: f.from,
      to: f.to,
      sort: f.sort,
      order: f.order,
    });
    return { data: res.data.map(toLog), pagination: res.pagination };
  },

  /** GET /admin/activity-logs/filters — distinct modules, actions and admins in the trail. */
  async filters(): Promise<ActivityFilterOptions> {
    return adminApi.get<ActivityFilterOptions>('/activity-logs/filters');
  },
};
