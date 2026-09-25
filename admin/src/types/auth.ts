import type { ID, ISODate } from './common';

export type PermissionModule =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'reviews'
  | 'discounts'
  | 'reports'
  | 'support'
  | 'settings';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

/** A single grant, e.g. { module: 'orders', action: 'edit' }. Serialised as "orders:edit". */
export interface Permission {
  module: PermissionModule;
  action: PermissionAction;
}

export type PermissionKey = `${PermissionModule}:${PermissionAction}`;

export type RoleSlug = 'super_admin' | 'store_manager' | 'product_manager' | 'order_manager' | 'support_manager' | (string & {});

export interface Role {
  id: ID;
  slug: RoleSlug;
  name: string;
  description: string;
  permissions: PermissionKey[];
  isSystem: boolean;
  userCount: number;
  updatedAt: ISODate;
}

export type AdminStatus = 'active' | 'invited' | 'deactivated';

export interface AdminUser {
  id: ID;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  roleId: ID;
  roleName: string;
  status: AdminStatus;
  lastLoginAt?: ISODate;
  createdAt: ISODate;
}

export interface AuthSession {
  user: AdminUser;
  role: Role;
  /** Opaque token issued by the backend. Mock sessions use a random string. */
  token: string;
  expiresAt: ISODate;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember: boolean;
}
