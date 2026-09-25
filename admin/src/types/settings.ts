import type { ID, ISODate } from './common';
import type { NotificationType } from './engagement';

export type CurrencyCode = 'DJF' | 'USD' | 'EUR';

/** GET/PATCH /admin/settings (nullable API fields are normalised to '' by settingsService). */
export interface StoreSettings {
  storeName: string;
  logoUrl?: string;
  tagline: string;
  /** Public contact email (API: supportEmail). */
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  currency: CurrencyCode;
  timezone: string;
  /** Default tax rate in percent. */
  taxRate: number;
  lowStockDefault: number;
  /** Prices already include tax. */
  taxInclusive?: boolean;
  /** Store-wide free-shipping threshold in whole currency units; null = never free. */
  freeShippingThreshold?: number | null;
  /** 2–6 letters prefixed to order numbers, e.g. "SPX". */
  orderPrefix?: string;
  /** Minutes an unpaid online order keeps its stock reserved. */
  pendingPaymentTtlMinutes?: number;
  /** Maximum quantity of one variant per cart line (1–10). */
  maxQuantityPerLine?: number;
  updatedAt?: ISODate;
}

/** Writable store settings (logo has its own upload endpoint). */
export type StoreSettingsInput = Partial<Omit<StoreSettings, 'logoUrl' | 'updatedAt'>>;

export interface ShippingMethod {
  id: ID;
  zoneId: ID;
  name: string;
  description: string;
  price: number;
  freeShippingThreshold?: number;
  estimatedDelivery: string;
  enabled: boolean;
  /** Stable code used by checkout (auto-generated from the name when omitted). */
  code?: string;
  minDays?: number;
  maxDays?: number;
  requiresAddress?: boolean;
  carrier?: string | null;
  sortOrder?: number;
}

export type ShippingMethodInput = Omit<ShippingMethod, 'id'>;

export interface ShippingZone {
  id: ID;
  name: string;
  regions: string[];
  enabled: boolean;
  methods: ShippingMethod[];
  sortOrder?: number;
}

// ─── Payments (read-only; credentials live in the API server's environment) ─────

/** Environment variable a provider needs — only whether it is set is ever returned. */
export interface PaymentEnvField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  configured: boolean;
}

/** GET /admin/settings/payments → providers[] */
export interface PaymentProviderStatus {
  id: string;
  name: string;
  description: string;
  methods: string[];
  enabled: boolean;
  configured: boolean;
  /** null when it cannot be derived (e.g. no key configured). */
  mode: 'test' | 'live' | null;
  requiresWebhook: boolean;
  webhookUrl: string | null;
  fields: PaymentEnvField[];
}

export interface PaymentSettings {
  providers: PaymentProviderStatus[];
  enabledOrder: string[];
  note: string;
}

/** @deprecated Mock-data shape only (src/data). The API exposes {@link PaymentProviderStatus}. */
export type PaymentProviderId = 'stripe' | 'mobile_money' | 'cash_on_delivery' | 'bank_transfer';

/** @deprecated Mock-data shape only. */
export interface PaymentProviderField {
  key: string;
  label: string;
  secret: boolean;
  value: string;
  placeholder: string;
  help?: string;
}

/** @deprecated Mock-data shape only. */
export interface PaymentProvider {
  id: PaymentProviderId;
  name: string;
  description: string;
  enabled: boolean;
  mode: 'test' | 'live';
  configured: boolean;
  fields: PaymentProviderField[];
}

// ─── Notifications ──────────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'sms' | 'in_app';

export interface NotificationPreference {
  event: NotificationType;
  label: string;
  description: string;
  channels: Record<NotificationChannel, boolean>;
}

// ─── Activity log ───────────────────────────────────────────────────────────

export interface ActivityLog {
  id: ID;
  /** Empty for system actions. */
  adminId: ID;
  adminName: string;
  adminEmail?: string;
  action: string;
  /** Audited entity type, e.g. "order", "shipping_zone". */
  module: string;
  record: string;
  recordLink?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
  status: 'success' | 'failed';
  createdAt: ISODate;
}

/** GET /admin/activity-logs/filters */
export interface ActivityFilterOptions {
  modules: string[];
  actions: string[];
  admins: { id: ID; name: string }[];
}
