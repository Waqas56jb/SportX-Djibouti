import { pool, queryOne, type Db } from '../../config/database.js';

export interface StoreSettings {
  storeName: string;
  tagline: string;
  supportEmail: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  country: string;
  currency: 'DJF' | 'USD' | 'EUR';
  timezone: string;
  logoUrl: string | null;
  taxRate: number;
  taxInclusive: boolean;
  freeShippingThreshold: number | null;
  orderPrefix: string;
  lowStockDefault: number;
  pendingPaymentTtlMinutes: number;
  maxQuantityPerLine: number;
  notificationSettings: Record<string, unknown>;
  updatedAt: string;
}

interface Row {
  store_name: string;
  tagline: string;
  support_email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  country: string;
  currency: StoreSettings['currency'];
  timezone: string;
  logo_url: string | null;
  tax_rate: number;
  tax_inclusive: boolean;
  free_shipping_threshold: number | null;
  order_prefix: string;
  low_stock_default: number;
  pending_payment_ttl_minutes: number;
  max_quantity_per_line: number;
  notification_settings: Record<string, unknown>;
  updated_at: Date;
}

export function mapSettings(r: Row): StoreSettings {
  return {
    storeName: r.store_name,
    tagline: r.tagline,
    supportEmail: r.support_email,
    phone: r.phone,
    addressLine1: r.address_line_1,
    addressLine2: r.address_line_2,
    city: r.city,
    country: r.country,
    currency: r.currency,
    timezone: r.timezone,
    logoUrl: r.logo_url,
    taxRate: Number(r.tax_rate),
    taxInclusive: r.tax_inclusive,
    freeShippingThreshold: r.free_shipping_threshold,
    orderPrefix: r.order_prefix,
    lowStockDefault: r.low_stock_default,
    pendingPaymentTtlMinutes: r.pending_payment_ttl_minutes,
    maxQuantityPerLine: r.max_quantity_per_line,
    notificationSettings: r.notification_settings ?? {},
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

let cache: { at: number; value: StoreSettings } | null = null;

export function invalidateSettings() {
  cache = null;
}

/** Store configuration (no secrets). Cached briefly; call invalidateSettings() after updates. */
export async function getStoreSettings(db: Db = pool): Promise<StoreSettings> {
  if (db === pool && cache && Date.now() - cache.at < 30_000) return cache.value;
  const row = await queryOne<Row>(`select * from public.store_settings where id = 1`, [], db);
  if (!row) throw new Error('store_settings row missing — run migrations.');
  const value = mapSettings(row);
  if (db === pool) cache = { at: Date.now(), value };
  return value;
}

/** Subset safe for anonymous storefront visitors. */
export function publicSettings(s: StoreSettings) {
  return {
    storeName: s.storeName,
    tagline: s.tagline,
    supportEmail: s.supportEmail,
    phone: s.phone,
    address: [s.addressLine1, s.addressLine2, s.city].filter(Boolean),
    country: s.country,
    currency: s.currency,
    timezone: s.timezone,
    logoUrl: s.logoUrl,
    taxRate: s.taxRate,
    taxInclusive: s.taxInclusive,
    freeShippingThreshold: s.freeShippingThreshold,
    maxQuantityPerLine: s.maxQuantityPerLine,
  };
}
