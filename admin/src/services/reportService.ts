import type {
  CategorySales,
  CustomerGrowthPoint,
  DashboardStats,
  DateRange,
  DateRangePreset,
  InventoryItem,
  KpiValue,
  SalesPoint,
  TopProduct,
} from '@/types';
import { appConfig } from '@/constants/config';
import { CATEGORY_WEIGHTS, dailyMetrics, HOURLY_WEIGHTS, type DailyMetric } from '@/data/analytics';
import { reportingCategory } from '@/data/catalog';
import { totalStock, variantStockStatus } from '@/utils/stock';
import { api } from './http';
import { db, delay } from './mock/db';
import { inventoryService } from './inventoryService';

const DAY = 86_400_000;

export const RANGE_PRESETS: { value: DateRangePreset; label: string; short: string }[] = [
  { value: 'today', label: 'Today', short: 'Today' },
  { value: '7d', label: 'Last 7 days', short: '7D' },
  { value: '30d', label: 'Last 30 days', short: '30D' },
  { value: '3m', label: 'Last 3 months', short: '3M' },
  { value: '12m', label: 'Last 12 months', short: '12M' },
];

type Bucket = 'hour' | 'day' | 'week' | 'month';

interface Bounds {
  from: Date;
  to: Date;
  days: number;
  bucket: Bucket;
  label: string;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function resolveRange(range: DateRange): Bounds {
  const today = startOfDay(new Date());
  switch (range.preset) {
    case 'today':
      return { from: today, to: today, days: 1, bucket: 'hour', label: 'Today' };
    case '7d':
      return { from: new Date(today.getTime() - 6 * DAY), to: today, days: 7, bucket: 'day', label: 'Last 7 days' };
    case '30d':
      return { from: new Date(today.getTime() - 29 * DAY), to: today, days: 30, bucket: 'day', label: 'Last 30 days' };
    case '3m':
      return { from: new Date(today.getTime() - 90 * DAY), to: today, days: 91, bucket: 'week', label: 'Last 3 months' };
    case '12m':
      return { from: new Date(today.getFullYear(), today.getMonth() - 11, 1), to: today, days: 365, bucket: 'month', label: 'Last 12 months' };
    case 'custom': {
      const from = startOfDay(range.from ? new Date(range.from) : new Date(today.getTime() - 29 * DAY));
      const to = startOfDay(range.to ? new Date(range.to) : today);
      const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY) + 1);
      return { from, to, days, bucket: days <= 62 ? 'day' : days <= 190 ? 'week' : 'month', label: 'Custom range' };
    }
  }
}

function metricsBetween(from: Date, to: Date): DailyMetric[] {
  const a = from.getTime();
  const b = to.getTime();
  return dailyMetrics.filter((m) => m.date.getTime() >= a && m.date.getTime() <= b);
}

/** Fraction of today's trading completed — so "today" isn't compared against a full day. */
function todayFraction() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const total = HOURLY_WEIGHTS.reduce((s, w) => s + w, 0);
  let done = 0;
  for (let i = 0; i < 24; i++) done += i + 1 <= h ? HOURLY_WEIGHTS[i] : i < h ? HOURLY_WEIGHTS[i] * (h - i) : 0;
  return Math.max(0.02, done / total);
}

function point(label: string, date: Date, ms: DailyMetric[], scale = 1): SalesPoint {
  const revenue = Math.round(ms.reduce((s, m) => s + m.revenue, 0) * scale);
  const orders = Math.round(ms.reduce((s, m) => s + m.orders, 0) * scale);
  const discounts = Math.round(ms.reduce((s, m) => s + m.discounts, 0) * scale);
  const refunds = Math.round(ms.reduce((s, m) => s + m.refunds, 0) * scale);
  return { date: date.toISOString(), label, revenue, orders, aov: orders ? Math.round(revenue / orders) : 0, discounts, refunds, netSales: revenue - discounts - refunds };
}

function series(b: Bounds): SalesPoint[] {
  const out: SalesPoint[] = [];
  if (b.bucket === 'hour') {
    const m = metricsBetween(b.from, b.to);
    const total = HOURLY_WEIGHTS.reduce((s, w) => s + w, 0);
    const nowH = new Date().getHours();
    for (let h = 0; h <= nowH; h++) {
      const d = new Date(b.from.getTime() + h * 3600_000);
      out.push(point(`${String(h).padStart(2, '0')}:00`, d, m, HOURLY_WEIGHTS[h] / total));
    }
    return out;
  }
  if (b.bucket === 'day') {
    for (let t = b.from.getTime(); t <= b.to.getTime(); t += DAY) {
      const d = new Date(t);
      const isToday = t === startOfDay(new Date()).getTime();
      out.push(point(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), d, metricsBetween(d, d), isToday ? todayFraction() : 1));
    }
    return out;
  }
  if (b.bucket === 'week') {
    for (let t = b.from.getTime(); t <= b.to.getTime(); t += 7 * DAY) {
      const s = new Date(t);
      const e = new Date(Math.min(t + 6 * DAY, b.to.getTime()));
      out.push(point(s.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), s, metricsBetween(s, e)));
    }
    return out;
  }
  const cursor = new Date(b.from.getFullYear(), b.from.getMonth(), 1);
  while (cursor.getTime() <= b.to.getTime()) {
    const s = new Date(cursor);
    const e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    out.push(point(s.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), s, metricsBetween(s, e > b.to ? b.to : e)));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

function previousBounds(b: Bounds): Bounds {
  if (b.bucket === 'month') return { ...b, from: new Date(b.from.getFullYear() - 1, b.from.getMonth(), 1), to: new Date(b.to.getTime() - 365 * DAY) };
  const span = b.days * DAY;
  return { ...b, from: new Date(b.from.getTime() - span), to: new Date(b.to.getTime() - span) };
}

function sumMetric(b: Bounds, key: keyof Omit<DailyMetric, 'date'>, partialToday = true) {
  const ms = metricsBetween(b.from, b.to);
  const todayT = startOfDay(new Date()).getTime();
  return Math.round(ms.reduce((s, m) => s + m[key] * (partialToday && m.date.getTime() === todayT ? todayFraction() : 1), 0));
}

function kpi(b: Bounds, key: keyof Omit<DailyMetric, 'date'>, trend: number[]): KpiValue {
  const value = sumMetric(b, key);
  const prevB = previousBounds(b);
  // Compare "today so far" with the same fraction of yesterday.
  const previous = b.bucket === 'hour' ? Math.round(sumMetric(prevB, key, false) * todayFraction()) : sumMetric(prevB, key, false);
  return { value, previous, change: previous ? ((value - previous) / previous) * 100 : 0, trend };
}

/** Deterministic per-product noise so rankings differ by period but stay stable. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function productRows(preset: DateRangePreset, days: number): TopProduct[] {
  const scale = Math.min(1.4, days / 365) * 2.2;
  return db.products
    .filter((p) => p.status !== 'draft')
    .map((p) => {
      const n = hash(p.id + preset);
      const units = Math.max(0, Math.round(p.unitsSold * scale * (0.6 + n * 0.8)));
      const views = Math.round(units * (22 + hash(p.slug) * 30)) + Math.round(40 * scale * 10 * hash(p.name));
      return {
        productId: p.id,
        name: p.name,
        productType: p.type,
        category: reportingCategory(p),
        brand: db.brands.find((b) => b.id === p.brandId)?.name ?? '—',
        unitsSold: units,
        revenue: units * p.price,
        views,
        conversion: views ? (units / views) * 100 : 0,
        stock: totalStock(p.variants),
        trend: Math.round((hash(p.id + preset + 't') - 0.4) * 60 * 10) / 10,
      };
    });
}

export interface SalesReport {
  range: string;
  totals: { revenue: number; orders: number; aov: number; discounts: number; refunds: number; netSales: number };
  previous: { revenue: number; orders: number; aov: number; discounts: number; refunds: number; netSales: number };
  series: SalesPoint[];
}

export interface CustomerReport {
  totals: { newCustomers: number; returningCustomers: number; averageSpend: number; ordersPerCustomer: number; totalCustomers: number; repeatRate: number };
  growth: CustomerGrowthPoint[];
  byCity: { name: string; value: number }[];
  byGroup: { name: string; value: number }[];
  topCustomers: { id: string; name: string; orders: number; spent: number }[];
}

export interface InventoryReport {
  totals: { products: number; variants: number; units: number; lowStock: number; outOfStock: number; inventoryValue: number; retailValue: number };
  aging: { bucket: string; units: number; value: number }[];
  movement: { label: string; inbound: number; outbound: number }[];
  topStocked: { productId: string; name: string; units: number; value: number }[];
  byStatus: { name: string; value: number }[];
  items: InventoryItem[];
}

export const reportService = {
  /** GET /reports/dashboard?range= */
  async getDashboardStats(range: DateRange): Promise<DashboardStats> {
    if (!appConfig.useMocks) return api.get<DashboardStats>('/reports/dashboard', { ...range });
    const b = resolveRange(range);
    const s = series(b);
    const inv = db.products.flatMap((p) => (p.status === 'archived' ? [] : p.variants));
    return delay({
      periodLabel: b.label,
      revenue: kpi(b, 'revenue', s.map((x) => x.revenue)),
      orders: kpi(b, 'orders', s.map((x) => x.orders)),
      customers: kpi(b, 'newCustomers', s.map((_, i) => Math.round(s[i].orders * 0.35))),
      productsSold: kpi(b, 'unitsSold', s.map((x) => Math.round(x.orders * 1.7))),
      pendingOrders: db.orders.filter((o) => o.status === 'pending' || o.status === 'processing').length,
      lowStock: inv.filter((v) => variantStockStatus(v) === 'low_stock').length,
      refundRequests: db.orders.filter((o) => o.payment.status === 'refund_pending').length,
      openTickets: db.tickets.filter((t) => t.status === 'open').length,
    });
  },

  /** GET /reports/sales/series?range= */
  async getSalesSeries(range: DateRange): Promise<SalesPoint[]> {
    if (!appConfig.useMocks) return api.get<SalesPoint[]>('/reports/sales/series', { ...range });
    return delay(series(resolveRange(range)));
  },

  /** GET /reports/sales/by-category?range= */
  async getCategorySales(range: DateRange): Promise<CategorySales[]> {
    if (!appConfig.useMocks) return api.get<CategorySales[]>('/reports/sales/by-category', { ...range });
    const b = resolveRange(range);
    const revenue = sumMetric(b, 'revenue');
    const units = sumMetric(b, 'unitsSold');
    const raw = Object.entries(CATEGORY_WEIGHTS).map(([category, w]) => ({ category, w: w * (0.85 + hash(category + range.preset) * 0.3) }));
    const total = raw.reduce((s, r) => s + r.w, 0);
    return delay(
      raw
        .map((r) => ({ category: r.category, share: (r.w / total) * 100, revenue: Math.round((revenue * r.w) / total), units: Math.round((units * r.w) / total) }))
        .sort((a, b2) => b2.revenue - a.revenue),
    );
  },

  /** GET /reports/products/top?range=&limit= */
  async getTopProducts(range: DateRange, limit = 5): Promise<TopProduct[]> {
    if (!appConfig.useMocks) return api.get<TopProduct[]>('/reports/products/top', { ...range, limit });
    const b = resolveRange(range);
    return delay(productRows(range.preset, b.days).sort((a, c) => c.revenue - a.revenue).slice(0, limit));
  },

  /** GET /reports/sales?range= */
  async getSalesReport(range: DateRange): Promise<SalesReport> {
    if (!appConfig.useMocks) return api.get<SalesReport>('/reports/sales', { ...range });
    const b = resolveRange(range);
    const tot = (bb: Bounds, partial: boolean) => {
      const revenue = sumMetric(bb, 'revenue', partial);
      const orders = sumMetric(bb, 'orders', partial);
      const discounts = sumMetric(bb, 'discounts', partial);
      const refunds = sumMetric(bb, 'refunds', partial);
      return { revenue, orders, aov: orders ? Math.round(revenue / orders) : 0, discounts, refunds, netSales: revenue - discounts - refunds };
    };
    return delay({ range: b.label, totals: tot(b, true), previous: tot(previousBounds(b), false), series: series(b) }, 500);
  },

  /** GET /reports/products */
  async getProductReport(range: DateRange, filters: { categoryName?: string; brand?: string; sport?: string } = {}): Promise<TopProduct[]> {
    if (!appConfig.useMocks) return api.get<TopProduct[]>('/reports/products', { ...range, ...filters });
    const b = resolveRange(range);
    const sportOf = (id: string) => db.products.find((p) => p.id === id)?.sport;
    return delay(
      productRows(range.preset, b.days)
        .filter((r) => !filters.categoryName || r.category === filters.categoryName)
        .filter((r) => !filters.brand || r.brand === filters.brand)
        .filter((r) => !filters.sport || sportOf(r.productId) === filters.sport)
        .sort((a, c) => c.revenue - a.revenue),
      500,
    );
  },

  /** GET /reports/customers */
  async getCustomerReport(range: DateRange): Promise<CustomerReport> {
    if (!appConfig.useMocks) return api.get<CustomerReport>('/reports/customers', { ...range });
    const b = resolveRange(range);
    const newC = sumMetric(b, 'newCustomers');
    const retC = sumMetric(b, 'returningCustomers');
    const revenue = sumMetric(b, 'revenue');
    const orders = sumMetric(b, 'orders');
    // Growth is always shown monthly over 12 months to answer "is the base growing?".
    const g = resolveRange({ preset: '12m' });
    let running = 2400;
    const growth: CustomerGrowthPoint[] = series(g).map((pt) => {
      const s = new Date(pt.date);
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
      const ms = metricsBetween(s, e);
      const n = ms.reduce((x, m) => x + m.newCustomers, 0);
      const r = ms.reduce((x, m) => x + m.returningCustomers, 0);
      running += n;
      return { label: pt.label, newCustomers: n, returningCustomers: r, total: running };
    });
    const cityCounts = new Map<string, number>();
    for (const c of db.customers) {
      const city = c.addresses[0]?.city ?? 'Unknown';
      cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
    }
    const groupLabel: Record<string, string> = { new: 'New', returning: 'Returning', high_value: 'High value', inactive: 'Inactive' };
    return delay(
      {
        totals: {
          newCustomers: newC,
          returningCustomers: retC,
          averageSpend: orders ? Math.round(revenue / Math.max(1, newC + retC)) : 0,
          ordersPerCustomer: Math.round((orders / Math.max(1, newC + retC * 0.6)) * 100) / 100,
          totalCustomers: running,
          repeatRate: newC + retC ? (retC / (newC + retC)) * 100 : 0,
        },
        growth,
        byCity: [...cityCounts.entries()].map(([name, value]) => ({ name, value })).sort((a, c) => c.value - a.value),
        byGroup: Object.entries(groupLabel).map(([k, name]) => ({ name, value: db.customers.filter((c) => c.groups.includes(k as never)).length })),
        topCustomers: [...db.customers]
          .sort((a, c) => c.totalSpent - a.totalSpent)
          .slice(0, 8)
          .map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, orders: c.ordersCount, spent: c.totalSpent })),
      },
      500,
    );
  },

  /** GET /reports/inventory */
  async getInventoryReport(): Promise<InventoryReport> {
    if (!appConfig.useMocks) return api.get<InventoryReport>('/reports/inventory');
    const items = await inventoryService.getInventory();
    const buckets = [
      { bucket: '0–30 days', min: 0, max: 30 },
      { bucket: '31–60 days', min: 31, max: 60 },
      { bucket: '61–90 days', min: 61, max: 90 },
      { bucket: '90+ days', min: 91, max: Infinity },
    ];
    const byProduct = new Map<string, { productId: string; name: string; units: number; value: number }>();
    for (const i of items) {
      const cur = byProduct.get(i.productId) ?? { productId: i.productId, name: i.productName, units: 0, value: 0 };
      cur.units += i.stock;
      cur.value += i.stock * i.unitCost;
      byProduct.set(i.productId, cur);
    }
    // Movement over the last 8 weeks: recorded movements + demo sales volume.
    const movement: InventoryReport['movement'] = [];
    const today = startOfDay(new Date()).getTime();
    for (let w = 7; w >= 0; w--) {
      const s = today - (w * 7 + 6) * DAY;
      const e = today - w * 7 * DAY + DAY - 1;
      const mv = db.stockMovements.filter((m) => {
        const t = new Date(m.createdAt).getTime();
        return t >= s && t <= e;
      });
      const sold = metricsBetween(new Date(s), new Date(e)).reduce((x, m) => x + m.unitsSold, 0);
      movement.push({
        label: new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        inbound: mv.filter((m) => m.quantity > 0).reduce((x, m) => x + m.quantity, 0) + Math.round(sold * (0.7 + hash(String(w)) * 0.6)),
        outbound: mv.filter((m) => m.quantity < 0).reduce((x, m) => x - m.quantity, 0) + sold,
      });
    }
    const productIds = new Set(items.map((i) => i.productId));
    return delay(
      {
        totals: {
          products: productIds.size,
          variants: items.length,
          units: items.reduce((s, i) => s + i.stock, 0),
          lowStock: items.filter((i) => i.status === 'low_stock').length,
          outOfStock: items.filter((i) => i.status === 'out_of_stock').length,
          inventoryValue: items.reduce((s, i) => s + i.stock * i.unitCost, 0),
          retailValue: items.reduce((s, i) => s + i.stock * (db.products.find((p) => p.id === i.productId)?.price ?? 0), 0),
        },
        aging: buckets.map((bk) => {
          const inB = items.filter((i) => i.daysSinceRestock >= bk.min && i.daysSinceRestock <= bk.max);
          return { bucket: bk.bucket, units: inB.reduce((s, i) => s + i.stock, 0), value: inB.reduce((s, i) => s + i.stock * i.unitCost, 0) };
        }),
        movement,
        topStocked: [...byProduct.values()].sort((a, c) => c.units - a.units).slice(0, 8),
        byStatus: [
          { name: 'In stock', value: items.filter((i) => i.status === 'in_stock').length },
          { name: 'Low stock', value: items.filter((i) => i.status === 'low_stock').length },
          { name: 'Out of stock', value: items.filter((i) => i.status === 'out_of_stock').length },
        ],
        items,
      },
      300,
    );
  },

  /** GET /reports/nav-counts — sidebar badges. */
  async getNavCounts(): Promise<Record<'orders' | 'lowStock' | 'support' | 'reviews' | 'refunds', number>> {
    if (!appConfig.useMocks) return api.get('/reports/nav-counts');
    const variants = db.products.flatMap((p) => (p.status === 'archived' ? [] : p.variants));
    return delay(
      {
        orders: db.orders.filter((o) => o.status === 'pending' || o.status === 'processing').length,
        lowStock: variants.filter((v) => variantStockStatus(v) === 'low_stock').length,
        support: db.tickets.filter((t) => t.status === 'open').length,
        reviews: db.reviews.filter((r) => r.status === 'pending').length,
        refunds: db.orders.filter((o) => o.payment.status === 'refund_pending').length,
      },
      100,
    );
  },
};
