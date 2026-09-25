/**
 * In-memory mock database. Seeded from `src/data/*` and mutated by the mock services so the
 * whole admin behaves consistently during a session. Replaced by the REST API later — nothing
 * outside `src/services` may import this module.
 */
import { brands, categories, products } from '@/data/catalog';
import { adminUsers, customers, roles } from '@/data/people';
import { orders } from '@/data/orders';
import { notifications, reviews, tickets } from '@/data/engagement';
import { campaigns, coupons, discounts, flashSales } from '@/data/marketing';
import {
  activityLogs,
  notificationPreferences,
  paymentProviders,
  shippingZones,
  stockMovements,
  storeSettings,
} from '@/data/settings';
import { appConfig } from '@/constants/config';
import type { ActivityLog } from '@/types';
import { uid } from '@/utils/id';

const clone = <T,>(v: T): T => structuredClone(v);

export const db = {
  products: clone(products),
  brands: clone(brands),
  categories: clone(categories),
  customers: clone(customers),
  orders: clone(orders),
  reviews: clone(reviews),
  tickets: clone(tickets),
  notifications: clone(notifications),
  coupons: clone(coupons),
  discounts: clone(discounts),
  flashSales: clone(flashSales),
  campaigns: clone(campaigns),
  adminUsers: clone(adminUsers),
  roles: clone(roles),
  stockMovements: clone(stockMovements),
  activityLogs: clone(activityLogs),
  storeSettings: clone(storeSettings),
  shippingZones: clone(shippingZones),
  paymentProviders: clone(paymentProviders),
  notificationPreferences: clone(notificationPreferences),
};

/** Simulated latency so loading states are visible and realistic. */
export function delay<T>(value: T, ms: number = appConfig.mockLatency): Promise<T> {
  const jitter = Math.round(ms * (0.6 + Math.random() * 0.8));
  return new Promise((resolve) => setTimeout(() => resolve(clone(value)), jitter));
}

export class NotFoundError extends Error {
  status = 404;
  constructor(entity: string) {
    super(`${entity} not found.`);
  }
}

// ─── Acting admin (for audit trail) ─────────────────────────────────────────
let actor = { id: 'system', name: 'System' };
export function setActor(a: { id: string; name: string } | null) {
  actor = a ?? { id: 'system', name: 'System' };
}
export function getActor() {
  return actor;
}

/** Append to the audit trail. On the backend this happens inside the same transaction as the change. */
export function audit(action: string, module: string, record: string, recordLink?: string, status: ActivityLog['status'] = 'success') {
  db.activityLogs.unshift({
    id: uid('act'),
    adminId: actor.id,
    adminName: actor.name,
    action,
    module,
    record,
    recordLink,
    ipAddress: '203.0.113.10',
    status,
    createdAt: new Date().toISOString(),
  });
}

export const now = () => new Date().toISOString();

export function matches(haystack: (string | undefined)[], needle?: string): boolean {
  if (!needle) return true;
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return haystack.some((h) => h?.toLowerCase().includes(q));
}
