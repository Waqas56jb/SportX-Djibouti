import type { PermissionKey, Role } from '@/types';
import { adminApi } from './api';

/** Roles & permission catalogue — /api/v1/admin/roles, /api/v1/admin/permissions. */

interface RoleDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  isStaff: boolean;
  immutable: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionGroup {
  module: string;
  label: string;
  permissions: { key: string; action: string; description: string }[];
}

export type RoleInput = Pick<Role, 'name' | 'description' | 'permissions'>;

/** The API slug is UPPER_SNAKE ("SUPER_ADMIN"); the UI compares lower-case ("super_admin"). */
export const toRole = (d: RoleDto): Role & { immutable: boolean } => ({
  id: d.id,
  slug: d.slug.toLowerCase(),
  name: d.name,
  description: d.description ?? '',
  permissions: (d.permissions ?? []) as PermissionKey[],
  isSystem: d.isSystem,
  immutable: d.immutable,
  userCount: d.userCount,
  updatedAt: d.updatedAt,
});

export const roleService = {
  /** GET /admin/roles — staff roles (Super Admin first). */
  async list(): Promise<Role[]> {
    return (await adminApi.get<RoleDto[]>('/roles')).map(toRole);
  },

  /** GET /admin/permissions — the permission catalogue grouped by module. */
  async permissions(): Promise<PermissionGroup[]> {
    return adminApi.get<PermissionGroup[]>('/permissions');
  },

  /** POST /admin/roles — the slug is derived from the name by the server. */
  async create(input: RoleInput): Promise<Role> {
    return toRole(await adminApi.post<RoleDto>('/roles', { name: input.name.trim(), description: input.description.trim(), permissions: input.permissions }));
  },

  /** PATCH /admin/roles/:id — Super Admin is immutable (403). */
  async update(id: string, input: Partial<RoleInput>): Promise<Role> {
    return toRole(await adminApi.patch<RoleDto>(`/roles/${id}`, { name: input.name?.trim(), description: input.description?.trim(), permissions: input.permissions }));
  },

  /** DELETE /admin/roles/:id — custom roles without members only. */
  async remove(id: string): Promise<void> {
    await adminApi.delete(`/roles/${id}`);
  },
};
