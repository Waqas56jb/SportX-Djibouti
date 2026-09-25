import type { ID, ISODate } from './common';
import type { NotificationType } from './engagement';

export type CurrencyCode = 'DJF' | 'USD' | 'EUR';

export interface StoreSettings {
  storeName: string;
  logoUrl?: string;
  tagline: string;
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
}

export interface ShippingMethod {
  id: ID;
  zoneId: ID;
  name: string;
  description: string;
  price: number;
  freeShippingThreshold?: number;
  estimatedDelivery: string;
  enabled: boolean;
}

export type ShippingMethodInput = Omit<ShippingMethod, 'id'>;

export interface ShippingZone {
  id: ID;
  name: string;
  regions: string[];
  enabled: boolean;
  methods: ShippingMethod[];
}

export type PaymentProviderId = 'stripe' | 'mobile_money' | 'cash_on_delivery' | 'bank_transfer';

export interface PaymentProviderField {
  key: string;
  label: string;
  /** Secret fields are write-only; the API only ever returns a masked hint (e.g. "••••4f2a") or empty. */
  secret: boolean;
  value: string;
  placeholder: string;
  help?: string;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  name: string;
  description: string;
  enabled: boolean;
  mode: 'test' | 'live';
  configured: boolean;
  fields: PaymentProviderField[];
}

export type NotificationChannel = 'email' | 'sms' | 'in_app';

export interface NotificationPreference {
  event: NotificationType;
  label: string;
  description: string;
  channels: Record<NotificationChannel, boolean>;
}

export interface ActivityLog {
  id: ID;
  adminId: ID;
  adminName: string;
  action: string;
  module: string;
  record: string;
  recordLink?: string;
  ipAddress: string;
  status: 'success' | 'failed';
  createdAt: ISODate;
}
