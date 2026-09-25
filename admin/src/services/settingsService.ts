import type {
  AdminUser,
  NotificationPreference,
  PaymentSettings,
  ShippingMethod,
  ShippingMethodInput,
  ShippingZone,
  StoreSettings,
  StoreSettingsInput,
} from '@/types';
import { adminApi } from './api';
import { staffService, type AdminUserInput } from './staffService';
import { roleService, type RoleInput } from './roleService';
import { activityService, type ActivityFilters } from './activityService';

export type { AdminUserInput, RoleInput, ActivityFilters };

// ─── DTOs (server/src/modules/settings + shipping) ─────────────────────────────

interface StoreSettingsDto {
  storeName: string;
  tagline: string;
  supportEmail: string | null;
  email?: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  country: string;
  currency: StoreSettings['currency'];
  timezone: string;
  logoUrl: string | null;
  taxRate: number;
  taxInclusive: boolean;
  freeShippingThreshold: number | null;
  orderPrefix: string;
  lowStockDefault: number;
  pendingPaymentTtlMinutes: number;
  maxQuantityPerLine: number;
  updatedAt: string;
}

interface ShippingMethodDto {
  id: string;
  zoneId: string;
  code: string;
  name: string;
  description: string;
  price: number;
  freeShippingThreshold: number | null;
  minDays: number;
  maxDays: number;
  estimatedDelivery: string;
  requiresAddress: boolean;
  carrier: string | null;
  enabled: boolean;
  sortOrder: number;
}

interface ShippingZoneDto {
  id: string;
  name: string;
  regions: string[];
  enabled: boolean;
  sortOrder: number;
  methods: ShippingMethodDto[];
}

const toStore = (d: StoreSettingsDto): StoreSettings => ({
  storeName: d.storeName,
  logoUrl: d.logoUrl ?? undefined,
  tagline: d.tagline ?? '',
  email: d.supportEmail ?? d.email ?? '',
  phone: d.phone ?? '',
  addressLine1: d.addressLine1 ?? '',
  addressLine2: d.addressLine2 ?? '',
  city: d.city ?? '',
  country: d.country ?? '',
  currency: d.currency,
  timezone: d.timezone,
  taxRate: Number(d.taxRate),
  lowStockDefault: d.lowStockDefault,
  taxInclusive: d.taxInclusive,
  freeShippingThreshold: d.freeShippingThreshold,
  orderPrefix: d.orderPrefix,
  pendingPaymentTtlMinutes: d.pendingPaymentTtlMinutes,
  maxQuantityPerLine: d.maxQuantityPerLine,
  updatedAt: d.updatedAt,
});

/** Frontend form → PATCH body. Empty optional text is sent as null so it can be cleared. */
function toStoreBody(s: StoreSettingsInput) {
  const nullable = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);
  return {
    storeName: s.storeName?.trim(),
    tagline: s.tagline?.trim(),
    supportEmail: s.email === undefined ? undefined : s.email.trim() || null,
    phone: nullable(s.phone),
    addressLine1: nullable(s.addressLine1),
    addressLine2: nullable(s.addressLine2),
    city: nullable(s.city),
    country: s.country?.trim(),
    currency: s.currency,
    timezone: s.timezone,
    taxRate: s.taxRate,
    taxInclusive: s.taxInclusive,
    freeShippingThreshold: s.freeShippingThreshold,
    orderPrefix: s.orderPrefix?.trim() || undefined,
    lowStockDefault: s.lowStockDefault,
    pendingPaymentTtlMinutes: s.pendingPaymentTtlMinutes,
    maxQuantityPerLine: s.maxQuantityPerLine,
  };
}

const toMethod = (m: ShippingMethodDto): ShippingMethod => ({
  id: m.id,
  zoneId: m.zoneId,
  code: m.code,
  name: m.name,
  description: m.description ?? '',
  price: m.price,
  freeShippingThreshold: m.freeShippingThreshold ?? undefined,
  estimatedDelivery: m.estimatedDelivery,
  minDays: m.minDays,
  maxDays: m.maxDays,
  requiresAddress: m.requiresAddress,
  carrier: m.carrier,
  enabled: m.enabled,
  sortOrder: m.sortOrder,
});

const toZone = (z: ShippingZoneDto): ShippingZone => ({ id: z.id, name: z.name, regions: z.regions ?? [], enabled: z.enabled, sortOrder: z.sortOrder, methods: (z.methods ?? []).map(toMethod) });

function toMethodBody(m: Partial<ShippingMethodInput>) {
  return {
    zoneId: m.zoneId,
    code: m.code,
    name: m.name,
    description: m.description,
    price: m.price,
    // null clears the threshold; undefined would keep the stored value.
    freeShippingThreshold: 'freeShippingThreshold' in m ? m.freeShippingThreshold ?? null : undefined,
    minDays: m.minDays,
    maxDays: m.maxDays,
    estimatedDelivery: m.estimatedDelivery,
    requiresAddress: m.requiresAddress,
    carrier: m.carrier,
    enabled: m.enabled,
    sortOrder: m.sortOrder,
  };
}

// ─── Notification events (the server stores whatever list the admin saves) ────

export const NOTIFICATION_EVENTS: Omit<NotificationPreference, 'channels'>[] = [
  { event: 'new_order', label: 'New order', description: 'A customer places an order.' },
  { event: 'payment_failed', label: 'Payment failure', description: 'A payment is declined or fails to capture.' },
  { event: 'low_stock', label: 'Low stock', description: 'A variant falls below its low-stock threshold.' },
  { event: 'refund_requested', label: 'Refund request', description: 'A customer requests a refund.' },
  { event: 'new_customer', label: 'New customer', description: 'A new customer account is created.' },
  { event: 'review_pending', label: 'New review', description: 'A review is submitted and awaits moderation.' },
  { event: 'new_ticket', label: 'Support ticket', description: 'A new support ticket is opened or escalated.' },
];

const DEFAULT_CHANNELS = { email: false, sms: false, in_app: true };

/** Merges the stored list with the known events so new events appear with defaults. */
function mergePreferences(stored: Partial<NotificationPreference>[]): NotificationPreference[] {
  const byEvent = new Map(stored.filter((p) => p.event).map((p) => [p.event as string, p]));
  return NOTIFICATION_EVENTS.map((e) => {
    const s = byEvent.get(e.event);
    return { ...e, channels: { ...DEFAULT_CHANNELS, ...(s?.channels ?? {}) } };
  });
}

export const settingsService = {
  // ─── Store ────────────────────────────────────────────────────────────────
  /** GET /admin/settings — store identity, contact, currency, tax, order defaults (no secrets). */
  async getStoreSettings(): Promise<StoreSettings> {
    return toStore(await adminApi.get<StoreSettingsDto>('/settings'));
  },

  /** PATCH /admin/settings — partial update; returns the saved settings. */
  async updateStoreSettings(input: StoreSettingsInput): Promise<StoreSettings> {
    return toStore(await adminApi.patch<StoreSettingsDto>('/settings', toStoreBody(input)));
  },

  /** POST /admin/settings/logo (multipart "file"; JPEG/PNG/WebP/AVIF, ≤ 5 MB). */
  async uploadLogo(file: File): Promise<StoreSettings> {
    return toStore(await adminApi.upload<StoreSettingsDto>('/settings/logo', file));
  },

  // ─── Shipping ─────────────────────────────────────────────────────────────
  /** GET /admin/shipping/zones — zones with their methods. */
  async getShippingZones(): Promise<ShippingZone[]> {
    return (await adminApi.get<ShippingZoneDto[]>('/shipping/zones')).map(toZone);
  },

  /** POST /admin/shipping/zones */
  async createZone(input: Pick<ShippingZone, 'name' | 'regions'> & { enabled?: boolean }): Promise<ShippingZone> {
    return toZone(await adminApi.post<ShippingZoneDto>('/shipping/zones', input));
  },

  /** PATCH /admin/shipping/zones/:id */
  async updateZone(id: string, patch: Partial<Pick<ShippingZone, 'name' | 'regions' | 'enabled' | 'sortOrder'>>): Promise<ShippingZone> {
    return toZone(await adminApi.patch<ShippingZoneDto>(`/shipping/zones/${id}`, patch));
  },

  /** DELETE /admin/shipping/zones/:id (deletes its methods too). */
  async deleteZone(id: string): Promise<void> {
    await adminApi.delete(`/shipping/zones/${id}`);
  },

  /** POST /admin/shipping/methods */
  async createMethod(input: ShippingMethodInput): Promise<ShippingMethod> {
    return toMethod(await adminApi.post<ShippingMethodDto>('/shipping/methods', toMethodBody(input)));
  },

  /** PATCH /admin/shipping/methods/:id — partial update. */
  async updateMethod(id: string, input: Partial<ShippingMethodInput>): Promise<ShippingMethod> {
    return toMethod(await adminApi.patch<ShippingMethodDto>(`/shipping/methods/${id}`, toMethodBody(input)));
  },

  /** DELETE /admin/shipping/methods/:id */
  async deleteMethod(id: string): Promise<void> {
    await adminApi.delete(`/shipping/methods/${id}`);
  },

  // ─── Payments ─────────────────────────────────────────────────────────────
  /**
   * GET /admin/settings/payments — read-only provider status. Keys and secrets are configured in
   * the API server environment; the response only says whether each one is present.
   */
  async getPaymentSettings(): Promise<PaymentSettings> {
    return adminApi.get<PaymentSettings>('/settings/payments');
  },

  // ─── Notification preferences ─────────────────────────────────────────────
  /** GET /admin/settings/notifications (store-wide alert channels per event). */
  async getNotificationPreferences(): Promise<NotificationPreference[]> {
    return mergePreferences(await adminApi.get<Partial<NotificationPreference>[]>('/settings/notifications'));
  },

  /** PUT /admin/settings/notifications */
  async updateNotificationPreferences(prefs: NotificationPreference[]): Promise<NotificationPreference[]> {
    const body = prefs.map((p) => ({ event: p.event, label: p.label, description: p.description, channels: p.channels }));
    return mergePreferences(await adminApi.put<Partial<NotificationPreference>[]>('/settings/notifications', body));
  },

  // ─── Compatibility shims (prefer staffService / roleService / activityService) ──
  /** First 100 staff accounts, e.g. for filter dropdowns. */
  getAdminUsers: (search?: string): Promise<AdminUser[]> => staffService.listAll(search),
  getRoles: () => roleService.list(),
  getActivityLogs: (filters: ActivityFilters = {}) => activityService.list(filters).then((r) => r.data),
};
