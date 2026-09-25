import type {
  ActivityLog,
  AdminUser,
  NotificationPreference,
  PaymentProvider,
  PaymentProviderId,
  PermissionKey,
  Role,
  ShippingMethod,
  ShippingMethodInput,
  ShippingZone,
  StoreSettings,
} from '@/types';
import { appConfig } from '@/constants/config';
import { uid } from '@/utils/id';
import { slugify } from '@/utils/format';
import { api, ApiError } from './http';
import { audit, db, delay, getActor, matches, NotFoundError, now } from './mock/db';

export interface ActivityFilters {
  search?: string;
  adminId?: string;
  module?: string;
  action?: string;
  from?: string;
  to?: string;
}

export type AdminUserInput = Pick<AdminUser, 'name' | 'email' | 'phone' | 'roleId'>;
export type RoleInput = Pick<Role, 'name' | 'description' | 'permissions'>;

/** Mask anything that looks like a credential so it can never be echoed back. */
const maskProvider = (p: PaymentProvider): PaymentProvider => ({
  ...p,
  fields: p.fields.map((f) => (f.secret ? { ...f, value: f.value ? `••••${f.value.slice(-4)}` : '' } : f)),
});

export const settingsService = {
  // ─── Store ────────────────────────────────────────────────────────────────
  /** GET /settings/store */
  async getStoreSettings(): Promise<StoreSettings> {
    if (!appConfig.useMocks) return api.get<StoreSettings>('/settings/store');
    return delay(db.storeSettings);
  },

  /** PUT /settings/store */
  async updateStoreSettings(input: StoreSettings): Promise<StoreSettings> {
    if (!appConfig.useMocks) return api.put<StoreSettings>('/settings/store', input);
    db.storeSettings = { ...input };
    audit('Store settings updated', 'Settings', input.storeName, '/settings/store');
    return delay(db.storeSettings, 600);
  },

  // ─── Shipping ─────────────────────────────────────────────────────────────
  /** GET /settings/shipping/zones */
  async getShippingZones(): Promise<ShippingZone[]> {
    if (!appConfig.useMocks) return api.get<ShippingZone[]>('/settings/shipping/zones');
    return delay(db.shippingZones);
  },

  /** POST /settings/shipping/zones */
  async createZone(input: Pick<ShippingZone, 'name' | 'regions'>): Promise<ShippingZone> {
    if (!appConfig.useMocks) return api.post<ShippingZone>('/settings/shipping/zones', input);
    const zone: ShippingZone = { ...input, id: uid('zone'), enabled: true, methods: [] };
    db.shippingZones.push(zone);
    audit('Shipping zone created', 'Settings', zone.name, '/settings/shipping');
    return delay(zone);
  },

  /** PATCH /settings/shipping/zones/:id */
  async updateZone(id: string, patch: Partial<Pick<ShippingZone, 'name' | 'regions' | 'enabled'>>): Promise<ShippingZone> {
    if (!appConfig.useMocks) return api.patch<ShippingZone>(`/settings/shipping/zones/${id}`, patch);
    const z = db.shippingZones.find((x) => x.id === id);
    if (!z) throw new NotFoundError('Shipping zone');
    Object.assign(z, patch);
    audit('Shipping zone updated', 'Settings', z.name, '/settings/shipping');
    return delay(z, 250);
  },

  /** DELETE /settings/shipping/zones/:id */
  async deleteZone(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.delete(`/settings/shipping/zones/${id}`);
    const z = db.shippingZones.find((x) => x.id === id);
    if (!z) throw new NotFoundError('Shipping zone');
    db.shippingZones = db.shippingZones.filter((x) => x.id !== id);
    audit('Shipping zone deleted', 'Settings', z.name);
    await delay(null);
  },

  /** POST /settings/shipping/methods */
  async createMethod(input: ShippingMethodInput): Promise<ShippingMethod> {
    if (!appConfig.useMocks) return api.post<ShippingMethod>('/settings/shipping/methods', input);
    const zone = db.shippingZones.find((z) => z.id === input.zoneId);
    if (!zone) throw new NotFoundError('Shipping zone');
    const m: ShippingMethod = { ...input, id: uid('shm') };
    zone.methods.push(m);
    audit('Shipping method created', 'Settings', `${zone.name} · ${m.name}`, '/settings/shipping');
    return delay(m);
  },

  /** PUT /settings/shipping/methods/:id */
  async updateMethod(id: string, input: ShippingMethodInput): Promise<ShippingMethod> {
    if (!appConfig.useMocks) return api.put<ShippingMethod>(`/settings/shipping/methods/${id}`, input);
    for (const z of db.shippingZones) {
      const idx = z.methods.findIndex((m) => m.id === id);
      if (idx >= 0) {
        const updated = { ...input, id };
        z.methods.splice(idx, 1);
        const target = db.shippingZones.find((x) => x.id === input.zoneId) ?? z;
        target.methods.push(updated);
        audit('Shipping method updated', 'Settings', updated.name, '/settings/shipping');
        return delay(updated);
      }
    }
    throw new NotFoundError('Shipping method');
  },

  /** DELETE /settings/shipping/methods/:id */
  async deleteMethod(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.delete(`/settings/shipping/methods/${id}`);
    for (const z of db.shippingZones) {
      const m = z.methods.find((x) => x.id === id);
      if (m) {
        z.methods = z.methods.filter((x) => x.id !== id);
        audit('Shipping method deleted', 'Settings', m.name);
        return delay(undefined);
      }
    }
    throw new NotFoundError('Shipping method');
  },

  // ─── Payments ─────────────────────────────────────────────────────────────
  /** GET /settings/payments — secret values are always masked by the API. */
  async getPaymentProviders(): Promise<PaymentProvider[]> {
    if (!appConfig.useMocks) return api.get<PaymentProvider[]>('/settings/payments');
    return delay(db.paymentProviders.map(maskProvider));
  },

  /**
   * PATCH /settings/payments/:id
   * Only non-secret fields and toggles are accepted from the browser. Secret credentials are
   * configured through server environment variables and are never sent from or to the frontend.
   */
  async updatePaymentProvider(id: PaymentProviderId, patch: { enabled?: boolean; mode?: 'test' | 'live'; fields?: Record<string, string> }): Promise<PaymentProvider> {
    if (!appConfig.useMocks) return api.patch<PaymentProvider>(`/settings/payments/${id}`, patch);
    const p = db.paymentProviders.find((x) => x.id === id);
    if (!p) throw new NotFoundError('Payment provider');
    if (patch.enabled !== undefined) p.enabled = patch.enabled;
    if (patch.mode) p.mode = patch.mode;
    if (patch.fields) {
      for (const f of p.fields) {
        if (f.secret) continue;
        if (patch.fields[f.key] !== undefined) f.value = patch.fields[f.key].trim();
      }
    }
    p.configured = p.fields.filter((f) => !f.secret).every((f) => f.value);
    audit('Payment settings updated', 'Settings', p.name, '/settings/payments');
    return delay(maskProvider(p), 500);
  },

  // ─── Notification preferences ─────────────────────────────────────────────
  /** GET /settings/notifications */
  async getNotificationPreferences(): Promise<NotificationPreference[]> {
    if (!appConfig.useMocks) return api.get<NotificationPreference[]>('/settings/notifications');
    return delay(db.notificationPreferences);
  },

  /** PUT /settings/notifications */
  async updateNotificationPreferences(prefs: NotificationPreference[]): Promise<NotificationPreference[]> {
    if (!appConfig.useMocks) return api.put<NotificationPreference[]>('/settings/notifications', prefs);
    db.notificationPreferences = prefs;
    audit('Notification settings updated', 'Settings', 'Notification channels', '/settings/notifications');
    return delay(prefs, 500);
  },

  // ─── Admin users ──────────────────────────────────────────────────────────
  /** GET /admin-users */
  async getAdminUsers(search?: string): Promise<AdminUser[]> {
    if (!appConfig.useMocks) return api.get<AdminUser[]>('/admin-users', { search });
    return delay(db.adminUsers.filter((u) => matches([u.name, u.email, u.roleName], search)));
  },

  /** POST /admin-users — sends an invitation email server-side. */
  async inviteAdmin(input: AdminUserInput): Promise<AdminUser> {
    if (!appConfig.useMocks) return api.post<AdminUser>('/admin-users', input);
    if (db.adminUsers.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw new ApiError('An admin with this email already exists.', 409);
    const role = db.roles.find((r) => r.id === input.roleId);
    if (!role) throw new NotFoundError('Role');
    const user: AdminUser = { ...input, id: uid('adm'), roleName: role.name, status: 'invited', createdAt: now() };
    db.adminUsers.push(user);
    role.userCount++;
    audit('Admin invited', 'Settings', user.email, '/settings/admin-users');
    return delay(user, 600);
  },

  /** PATCH /admin-users/:id */
  async updateAdmin(id: string, input: AdminUserInput): Promise<AdminUser> {
    if (!appConfig.useMocks) return api.patch<AdminUser>(`/admin-users/${id}`, input);
    const u = db.adminUsers.find((x) => x.id === id);
    if (!u) throw new NotFoundError('Admin user');
    const role = db.roles.find((r) => r.id === input.roleId);
    if (!role) throw new NotFoundError('Role');
    if (u.roleId === 'role_super_admin' && input.roleId !== 'role_super_admin' && db.adminUsers.filter((x) => x.roleId === 'role_super_admin' && x.status === 'active').length <= 1)
      throw new ApiError('At least one active Super Admin is required.', 400);
    Object.assign(u, input, { roleName: role.name });
    for (const r of db.roles) r.userCount = db.adminUsers.filter((x) => x.roleId === r.id).length;
    audit('Admin updated', 'Settings', u.email, '/settings/admin-users');
    return delay(u);
  },

  /** PATCH /admin-users/:id/status */
  async setAdminStatus(id: string, status: AdminUser['status']): Promise<AdminUser> {
    if (!appConfig.useMocks) return api.patch<AdminUser>(`/admin-users/${id}/status`, { status });
    const u = db.adminUsers.find((x) => x.id === id);
    if (!u) throw new NotFoundError('Admin user');
    if (u.id === getActor().id && status === 'deactivated') throw new ApiError('You cannot deactivate your own account.', 400);
    u.status = status;
    audit(status === 'deactivated' ? 'Admin deactivated' : 'Admin reactivated', 'Settings', u.email, '/settings/admin-users');
    return delay(u);
  },

  /** POST /admin-users/:id/reset-access — revokes sessions and emails a reset link. */
  async resetAccess(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.post(`/admin-users/${id}/reset-access`);
    const u = db.adminUsers.find((x) => x.id === id);
    if (!u) throw new NotFoundError('Admin user');
    audit('Admin access reset', 'Settings', u.email, '/settings/admin-users');
    await delay(null, 600);
  },

  // ─── Roles ────────────────────────────────────────────────────────────────
  /** GET /roles */
  async getRoles(): Promise<Role[]> {
    if (!appConfig.useMocks) return api.get<Role[]>('/roles');
    for (const r of db.roles) r.userCount = db.adminUsers.filter((x) => x.roleId === r.id).length;
    return delay(db.roles);
  },

  /** POST /roles */
  async createRole(input: RoleInput): Promise<Role> {
    if (!appConfig.useMocks) return api.post<Role>('/roles', input);
    const slug = slugify(input.name).replace(/-/g, '_');
    if (db.roles.some((r) => r.slug === slug)) throw new ApiError('A role with this name already exists.', 409);
    const role: Role = { ...input, id: uid('role'), slug, isSystem: false, userCount: 0, updatedAt: now() };
    db.roles.push(role);
    audit('Role created', 'Settings', role.name, '/settings/roles');
    return delay(role);
  },

  /** PUT /roles/:id */
  async updateRole(id: string, input: RoleInput): Promise<Role> {
    if (!appConfig.useMocks) return api.put<Role>(`/roles/${id}`, input);
    const role = db.roles.find((r) => r.id === id);
    if (!role) throw new NotFoundError('Role');
    if (role.slug === 'super_admin') throw new ApiError('Super Admin permissions cannot be modified.', 400);
    Object.assign(role, { ...input, permissions: [...new Set<PermissionKey>(input.permissions)] }, { updatedAt: now() });
    for (const u of db.adminUsers) if (u.roleId === id) u.roleName = role.name;
    audit('Role permissions updated', 'Settings', role.name, '/settings/roles');
    return delay(role, 500);
  },

  /** DELETE /roles/:id */
  async deleteRole(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.delete(`/roles/${id}`);
    const role = db.roles.find((r) => r.id === id);
    if (!role) throw new NotFoundError('Role');
    if (role.isSystem) throw new ApiError('Default roles cannot be deleted.', 400);
    if (db.adminUsers.some((u) => u.roleId === id)) throw new ApiError('Reassign admins using this role before deleting it.', 409);
    db.roles = db.roles.filter((r) => r.id !== id);
    audit('Role deleted', 'Settings', role.name);
    await delay(null);
  },

  // ─── Activity log ─────────────────────────────────────────────────────────
  /** GET /activity */
  async getActivityLogs(filters: ActivityFilters = {}): Promise<ActivityLog[]> {
    if (!appConfig.useMocks) return api.get<ActivityLog[]>('/activity', { ...filters });
    return delay(
      db.activityLogs
        .filter((a) => matches([a.action, a.record, a.adminName, a.module], filters.search))
        .filter((a) => !filters.adminId || a.adminId === filters.adminId)
        .filter((a) => !filters.module || a.module === filters.module)
        .filter((a) => !filters.action || a.action === filters.action)
        .filter((a) => !filters.from || a.createdAt >= filters.from)
        .filter((a) => !filters.to || a.createdAt <= filters.to)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  },
};
