import type { AdminStatus, AdminUser } from '@/types';
import { adminApi, type Pagination } from './api';

/** Staff (admin users) — /api/v1/admin/staff. */

interface StaffDto {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: { id: string; slug: string; name: string }[];
  roleId: string | null;
  roleSlug: string | null;
  roleName: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  invited: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** AdminUser plus the API's role slug (lower-case, e.g. "super_admin") and raw account status. */
export interface StaffMember extends AdminUser {
  firstName: string;
  lastName: string;
  roleSlug: string;
  accountStatus: StaffDto['status'];
}

export type AdminUserInput = Pick<AdminUser, 'name' | 'email' | 'phone' | 'roleId'>;

export type StaffSort = 'name' | 'email' | 'created_at' | 'last_login_at';

export interface StaffQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Role id or slug. */
  role?: string;
  /** "invited" is not a server-side state; it is filtered as ACTIVE. */
  status?: AdminStatus | '';
  sort?: StaffSort;
  order?: 'asc' | 'desc';
}

const STATUS_TO_API: Record<AdminStatus, StaffDto['status']> = { active: 'ACTIVE', invited: 'ACTIVE', deactivated: 'INACTIVE' };

export const toStaff = (d: StaffDto): StaffMember => ({
  id: d.id,
  firstName: d.firstName,
  lastName: d.lastName,
  name: d.name || `${d.firstName} ${d.lastName}`.trim(),
  email: d.email,
  phone: d.phone || undefined,
  avatarUrl: d.avatarUrl ?? undefined,
  roleId: d.roleId ?? '',
  roleName: d.roleName ?? 'No role',
  roleSlug: (d.roleSlug ?? '').toLowerCase(),
  status: d.status !== 'ACTIVE' ? 'deactivated' : d.invited ? 'invited' : 'active',
  accountStatus: d.status,
  lastLoginAt: d.lastLoginAt ?? undefined,
  createdAt: d.createdAt,
});

export const staffService = {
  /** GET /admin/staff — server-side search, filters, sort and pagination. */
  async list(q: StaffQuery = {}): Promise<{ data: StaffMember[]; pagination: Pagination }> {
    const res = await adminApi.page<StaffDto>('/staff', {
      page: q.page,
      limit: q.limit,
      search: q.search?.trim() || undefined,
      role: q.role || undefined,
      status: q.status ? STATUS_TO_API[q.status] : undefined,
      sort: q.sort,
      order: q.order,
    });
    return { data: res.data.map(toStaff), pagination: res.pagination };
  },

  /** Up to 100 staff accounts (for dropdowns). */
  async listAll(search?: string): Promise<StaffMember[]> {
    return (await staffService.list({ search, limit: 100, sort: 'name', order: 'asc' })).data;
  },

  /** GET /admin/staff/:id */
  async get(id: string): Promise<StaffMember> {
    return toStaff(await adminApi.get<StaffDto>(`/staff/${id}`));
  },

  /**
   * POST /admin/staff — creates the account with a random password and emails a set-password link.
   * No password is ever chosen or seen by the inviting admin.
   */
  async invite(input: AdminUserInput): Promise<StaffMember> {
    return toStaff(await adminApi.post<StaffDto>('/staff', { name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone?.trim() || null, roleId: input.roleId }));
  },

  /** PATCH /admin/staff/:id — name, phone and role (email cannot be changed here). */
  async update(id: string, input: Partial<AdminUserInput>): Promise<StaffMember> {
    return toStaff(
      await adminApi.patch<StaffDto>(`/staff/${id}`, {
        name: input.name?.trim() || undefined,
        phone: input.phone === undefined ? undefined : input.phone.trim() || null,
        roleId: input.roleId || undefined,
      }),
    );
  },

  /** PATCH /admin/staff/:id/status — deactivating also revokes the user's sessions. */
  async setStatus(id: string, status: 'active' | 'deactivated', reason?: string): Promise<StaffMember> {
    return toStaff(await adminApi.patch<StaffDto>(`/staff/${id}/status`, { status: status === 'active' ? 'ACTIVE' : 'INACTIVE', reason }));
  },

  /** POST /admin/staff/:id/reset-access — revokes sessions; emails a reset link when the account is active. */
  async resetAccess(id: string): Promise<{ sessionsRevoked: boolean; resetEmailSent: boolean }> {
    return adminApi.post(`/staff/${id}/reset-access`);
  },
};
