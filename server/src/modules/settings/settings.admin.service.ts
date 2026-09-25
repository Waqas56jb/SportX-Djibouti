import { z } from 'zod';
import type { Request } from 'express';
import { query, queryOne, withTransaction } from '../../config/database.js';
import { env } from '../../config/env.js';
import { badRequest } from '../../utils/errors.js';
import { audit } from '../../services/audit.service.js';
import { enabledProviders } from '../../services/payment/payment.registry.js';
import { cashOnDeliveryProvider } from '../../services/payment/providers/cod.provider.js';
import { mockProvider } from '../../services/payment/providers/mock.provider.js';
import { stripeProvider } from '../../services/payment/providers/stripe.provider.js';
import type { PaymentProvider } from '../../services/payment/payment.provider.js';
import { getStoreSettings, invalidateSettings, type StoreSettings } from './settings.service.js';

/** Admin view of the store settings (the table holds no secrets). `email` mirrors supportEmail for the admin UI. */
export async function adminSettings() {
  invalidateSettings();
  const s = await getStoreSettings();
  return { ...s, email: s.supportEmail };
}

const validTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const optText = (max: number) => z.string().trim().max(max).nullable().optional();

export const settingsBody = z
  .object({
    storeName: z.string().trim().min(2).max(80).optional(),
    tagline: z.string().trim().max(160).optional(),
    supportEmail: z.string().trim().email().max(160).nullable().optional().or(z.literal('')),
    email: z.string().trim().email().max(160).nullable().optional().or(z.literal('')),
    phone: optText(40),
    addressLine1: optText(160),
    addressLine2: optText(160),
    city: optText(80),
    country: z.string().trim().min(2).max(80).optional(),
    currency: z.enum(['DJF', 'USD', 'EUR']).optional(),
    timezone: z.string().trim().max(64).refine(validTimezone, 'Unknown timezone.').optional(),
    taxRate: z.number().min(0).max(100).optional(),
    taxInclusive: z.boolean().optional(),
    freeShippingThreshold: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    orderPrefix: z.string().trim().transform((s) => s.toUpperCase()).pipe(z.string().regex(/^[A-Z]{2,6}$/, 'Use 2–6 letters.')).optional(),
    lowStockDefault: z.number().int().min(0).max(100_000).optional(),
    pendingPaymentTtlMinutes: z.number().int().min(5).max(10_080).optional(),
    // cart_items.quantity is capped at 10 by the schema, so the per-line maximum cannot exceed it.
    maxQuantityPerLine: z.number().int().min(1).max(10).optional(),
    notificationSettings: z.record(z.unknown()).optional(),
  })
  .refine((b) => !b.notificationSettings || JSON.stringify(b.notificationSettings).length <= 20_000, { message: 'Notification settings are too large.', path: ['notificationSettings'] });
export type SettingsBody = z.infer<typeof settingsBody>;

/** API field → column (fixed identifiers only). */
const COLUMNS: Partial<Record<keyof SettingsBody, string>> = {
  storeName: 'store_name',
  tagline: 'tagline',
  supportEmail: 'support_email',
  phone: 'phone',
  addressLine1: 'address_line_1',
  addressLine2: 'address_line_2',
  city: 'city',
  country: 'country',
  currency: 'currency',
  timezone: 'timezone',
  taxRate: 'tax_rate',
  taxInclusive: 'tax_inclusive',
  freeShippingThreshold: 'free_shipping_threshold',
  orderPrefix: 'order_prefix',
  lowStockDefault: 'low_stock_default',
  pendingPaymentTtlMinutes: 'pending_payment_ttl_minutes',
  maxQuantityPerLine: 'max_quantity_per_line',
  notificationSettings: 'notification_settings',
};

export async function updateSettings(req: Request, input: SettingsBody) {
  const b: SettingsBody = { ...input };
  if (b.email !== undefined && b.supportEmail === undefined) b.supportEmail = b.email;
  delete b.email;
  const sets: string[] = [];
  const params: unknown[] = [];
  const changed: string[] = [];
  for (const [key, col] of Object.entries(COLUMNS) as [keyof SettingsBody, string][]) {
    let v = b[key];
    if (v === undefined) continue;
    if (v === '') v = null;
    if (key === 'notificationSettings') v = JSON.stringify(v);
    params.push(v);
    sets.push(`${col} = $${params.length}${key === 'notificationSettings' ? '::jsonb' : ''}`);
    changed.push(key);
  }
  if (!sets.length) throw badRequest('Nothing to update.');
  params.push(req.auth!.userId);
  await withTransaction(async (tx) => {
    await query(`update public.store_settings set ${sets.join(', ')}, updated_by = $${params.length} where id = 1`, params, tx);
    await audit(req, { action: 'Store settings updated', entityType: 'settings', entityId: 'store', metadata: { fields: changed } }, tx);
  });
  invalidateSettings();
  return adminSettings();
}

export async function setLogo(req: Request, url: string) {
  await withTransaction(async (tx) => {
    await query(`update public.store_settings set logo_url = $1, updated_by = $2 where id = 1`, [url, req.auth!.userId], tx);
    await audit(req, { action: 'Store logo updated', entityType: 'settings', entityId: 'store', metadata: {} }, tx);
  });
  invalidateSettings();
  return adminSettings();
}

// ─── Notification preferences (stored inside notification_settings.preferences) ─

export async function notificationPreferences(): Promise<unknown[]> {
  const s: StoreSettings = await adminSettings();
  const prefs = (s.notificationSettings as { preferences?: unknown }).preferences;
  return Array.isArray(prefs) ? prefs : [];
}

export const preferencesBody = z
  .array(
    z.object({
      event: z.string().trim().min(2).max(60),
      label: z.string().trim().max(120).optional(),
      description: z.string().trim().max(300).optional(),
      channels: z.object({ email: z.boolean().default(false), sms: z.boolean().default(false), in_app: z.boolean().default(true) }),
    }),
  )
  .max(50);

export async function savePreferences(req: Request, prefs: z.infer<typeof preferencesBody>) {
  await withTransaction(async (tx) => {
    const row = await queryOne<{ notification_settings: Record<string, unknown> }>(`select notification_settings from public.store_settings where id = 1 for update`, [], tx);
    const next = { ...(row?.notification_settings ?? {}), preferences: prefs };
    await query(`update public.store_settings set notification_settings = $1::jsonb, updated_by = $2 where id = 1`, [JSON.stringify(next), req.auth!.userId], tx);
    await audit(req, { action: 'Notification settings updated', entityType: 'settings', entityId: 'notifications', metadata: { events: prefs.length } }, tx);
  });
  invalidateSettings();
  return prefs;
}

// ─── Payment providers (read-only; credentials live in server env vars) ────────

interface EnvField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  present: boolean;
}

const has = (v: string | undefined) => Boolean(v && v.trim());

/** Test/live hint from the key prefix — the key itself is never returned. */
function stripeMode(): 'test' | 'live' | null {
  const k = env.STRIPE_SECRET_KEY ?? '';
  if (/^(sk|rk)_live_/.test(k)) return 'live';
  if (/^(sk|rk)_test_/.test(k)) return 'test';
  return null;
}

const KNOWN: { provider: PaymentProvider; description: string; fields: () => EnvField[]; mode: () => 'test' | 'live' | null }[] = [
  {
    provider: cashOnDeliveryProvider,
    description: 'Customers pay the courier on delivery. Marked paid when the order is delivered.',
    fields: () => [],
    mode: () => 'live',
  },
  {
    provider: stripeProvider,
    description: 'Card payments through Stripe PaymentIntents. Orders are confirmed by the signed Stripe webhook.',
    fields: () => [
      { key: 'STRIPE_SECRET_KEY', label: 'Secret key', secret: true, required: true, present: has(env.STRIPE_SECRET_KEY) },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook signing secret', secret: true, required: true, present: has(env.STRIPE_WEBHOOK_SECRET) },
    ],
    mode: stripeMode,
  },
  {
    provider: mockProvider,
    description: 'Simulated online payments for development and testing. Cannot be enabled in production.',
    fields: () => [{ key: 'MOCK_PAYMENT_WEBHOOK_SECRET', label: 'Webhook signing secret (optional)', secret: true, required: false, present: has(env.MOCK_PAYMENT_WEBHOOK_SECRET) }],
    mode: () => 'test',
  },
];

/**
 * Provider status for the admin. NEVER includes key values, prefixes or masked fragments —
 * only whether each required environment variable is present.
 */
export function paymentSettings() {
  const enabledIds = new Set(enabledProviders.map((p) => p.id));
  const base = env.API_BASE_URL.replace(/\/$/, '');
  const providers = KNOWN.map(({ provider, description, fields, mode }) => {
    const f = fields();
    return {
      id: provider.id,
      name: provider.displayName,
      description,
      methods: provider.methods,
      enabled: enabledIds.has(provider.id),
      configured: f.filter((x) => x.required).every((x) => x.present),
      mode: mode(),
      requiresWebhook: provider.requiresWebhookConfirmation,
      webhookUrl: provider.requiresWebhookConfirmation ? `${base}/api/v1/payments/webhook/${provider.id}` : null,
      fields: f.map((x) => ({ key: x.key, label: x.label, secret: x.secret, required: x.required, configured: x.present })),
    };
  });
  return {
    providers,
    enabledOrder: [...enabledIds],
    note: 'Payment credentials are configured through server environment variables (PAYMENT_PROVIDERS, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) and are never sent to or accepted from the browser.',
  };
}

