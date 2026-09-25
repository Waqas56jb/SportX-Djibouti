import type {
  CategorySales,
  CustomerGrowthPoint,
  DashboardData,
  DateRange,
  DateRangePreset,
  NavCounts,
  ProductStatus,
  ProductType,
  RecentOrder,
  SalesPoint,
  TopProduct,
} from '@/types';
import { adminApi, download, type Query } from './api';

const DAY = 86_400_000;

export const RANGE_PRESETS: { value: DateRangePreset; label: string; short: string }[] = [
  { value: 'today', label: 'Today', short: 'Today' },
  { value: '7d', label: 'Last 7 days', short: '7D' },
  { value: '30d', label: 'Last 30 days', short: '30D' },
  { value: '3m', label: 'Last 3 months', short: '3M' },
  { value: '12m', label: 'Last 12 months', short: '12M' },
];

export type ReportBucket = 'hour' | 'day' | 'week' | 'month';

interface Bounds {
  from: Date;
  to: Date;
  days: number;
  bucket: ReportBucket;
  label: string;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Client-side approximation of a range (labels / captions only — the API resolves real bounds). */
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

/** Local calendar date (YYYY-MM-DD) of an ISO timestamp — what the admin picked in the date input. */
function localDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** DateRange → API `range` / `from` / `to` query. */
export function rangeQuery(range: DateRange): Query {
  if (range.preset === 'custom' && range.from && range.to) return { range: 'custom', from: localDate(range.from), to: localDate(range.to) };
  return { range: range.preset === 'custom' ? '30d' : range.preset };
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? undefined : v);
const lower = (s: string | null | undefined) => (s ?? '').toLowerCase();

// ─── API shapes ─────────────────────────────────────────────────────────────

interface ApiKpi {
  value: number;
  previous: number;
  change: number | null;
  trend: number[];
}

interface ApiTopProduct {
  productId: string;
  name: string;
  slug?: string | null;
  sku?: string;
  image: string | null;
  category: string | null;
  brand: string | null;
  productType: string | null;
  sport?: string;
  status?: string;
  unitsSold: number;
  revenue: number;
  views?: number;
  conversion?: number | null;
  stock: number;
  trend?: number | null;
}

interface ApiOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  customer: { firstName: string | null; lastName: string | null; email: string | null };
  itemsCount: number;
  grandTotal: number;
  image: string | null;
  placedAt: string;
}

interface ApiDashboard {
  range: DashboardData['range'];
  sales: { averageOrderValue: number };
  orders: { pending: number; refundRequests: number };
  products: { lowStockVariants: number; outOfStockVariants: number };
  supportOpen: number;
  reviewsPending: number;
  recentOrders: ApiOrderSummary[];
  topProducts: ApiTopProduct[];
  salesChart: { date: string; label: string; revenue: number; orders: number; aov: number; units: number; newCustomers: number }[];
  salesByCategory: CategorySales[];
  kpis: { revenue: ApiKpi; orders: ApiKpi; customers: ApiKpi; productsSold: ApiKpi };
}

interface ApiSalesTotals {
  revenue: number;
  orders: number;
  aov: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  shipping: number;
  tax: number;
  netSales: number;
}

export interface SalesReport {
  range: string;
  bucket: ReportBucket;
  totals: ApiSalesTotals;
  previous: ApiSalesTotals;
  /** % change per total (undefined when the previous period had none). */
  change: Partial<Record<keyof ApiSalesTotals, number>>;
  series: SalesPoint[];
}

export interface ProductReportFilters {
  categoryId?: string;
  brandId?: string;
  sport?: string;
  search?: string;
  status?: ProductStatus | '';
  sort?: 'revenue' | 'units' | 'views' | 'conversion' | 'stock' | 'name' | 'trend';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ProductReport {
  totals: { products: number; unitsSold: number; revenue: number; views: number; conversion?: number };
  best: TopProduct[];
  worst: TopProduct[];
  items: TopProduct[];
  total: number;
}

export interface CustomerReport {
  bucket: ReportBucket;
  totals: { newCustomers: number; returningCustomers: number; averageSpend: number; ordersPerCustomer: number; totalCustomers: number; repeatRate: number; buyers: number };
  growth: CustomerGrowthPoint[];
  byCity: { name: string; value: number }[];
  byGroup: { name: string; value: number }[];
  topCustomers: { id: string; name: string; email?: string; orders: number; spent: number }[];
}

export interface InventoryReport {
  bucket: ReportBucket;
  totals: {
    products: number;
    variants: number;
    units: number;
    reserved: number;
    lowStock: number;
    outOfStock: number;
    inventoryValue: number;
    retailValue: number;
    /** Variants in stock whose product has no cost price (counted as 0 in inventoryValue). */
    variantsMissingCost: number;
  };
  aging: { bucket: string; units: number; value: number; variants?: number }[];
  movement: { label: string; inbound: number; outbound: number }[];
  topStocked: { productId: string; name: string; units: number; value: number; retailValue?: number }[];
  byStatus: { name: string; value: number }[];
}

// ─── Mappers ────────────────────────────────────────────────────────────────

const kpi = (k: ApiKpi) => ({ value: k.value, previous: k.previous, change: pct(k.change), trend: k.trend });

export const toTopProduct = (p: ApiTopProduct): TopProduct => ({
  productId: p.productId,
  name: p.name,
  productType: (p.productType ?? '') as ProductType,
  category: p.category ?? '—',
  brand: p.brand ?? '—',
  unitsSold: p.unitsSold,
  revenue: p.revenue,
  views: p.views ?? 0,
  conversion: p.conversion ?? 0,
  stock: p.stock,
  trend: p.trend ?? 0,
  image: p.image ?? undefined,
  sku: p.sku,
  sport: p.sport,
  status: p.status ? (lower(p.status) as ProductStatus) : undefined,
});

const toRecentOrder = (o: ApiOrderSummary): RecentOrder => ({
  id: o.id,
  number: o.orderNumber,
  customerName: [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || o.customer?.email || 'Guest',
  itemsCount: o.itemsCount,
  total: o.grandTotal,
  status: lower(o.status) as RecentOrder['status'],
  paymentStatus: lower(o.paymentStatus) as RecentOrder['paymentStatus'],
  image: o.image ?? undefined,
  createdAt: o.placedAt,
});

const salesPoint = (p: ApiSalesTotals & { date: string; label: string }): SalesPoint => ({
  date: p.date,
  label: p.label,
  revenue: p.revenue,
  orders: p.orders,
  aov: p.aov,
  discounts: p.discounts,
  refunds: p.refunds,
  netSales: p.netSales,
  grossSales: p.grossSales,
  shipping: p.shipping,
  tax: p.tax,
});

const stamp = () => new Date().toISOString().slice(0, 10);

export const reportService = {
  /** GET /admin/dashboard?range= — KPIs, attention counters, charts, top products and recent orders in one call. */
  async getDashboard(range: DateRange): Promise<DashboardData> {
    const d = await adminApi.get<ApiDashboard>('/dashboard', rangeQuery(range));
    return {
      range: d.range,
      stats: {
        periodLabel: d.range.label,
        revenue: kpi(d.kpis.revenue),
        orders: kpi(d.kpis.orders),
        customers: kpi(d.kpis.customers),
        productsSold: kpi(d.kpis.productsSold),
        pendingOrders: d.orders.pending,
        lowStock: d.products.lowStockVariants,
        outOfStock: d.products.outOfStockVariants,
        refundRequests: d.orders.refundRequests,
        openTickets: d.supportOpen,
        pendingReviews: d.reviewsPending,
        averageOrderValue: d.sales.averageOrderValue,
      },
      salesChart: d.salesChart.map((p) => ({ ...p, discounts: 0, refunds: 0, netSales: p.revenue })),
      salesByCategory: d.salesByCategory,
      topProducts: d.topProducts.map(toTopProduct),
      recentOrders: d.recentOrders.map(toRecentOrder),
    };
  },

  /** GET /admin/reports/sales?range=&groupBy= */
  async getSalesReport(range: DateRange, groupBy?: ReportBucket): Promise<SalesReport> {
    const r = await adminApi.get<{
      range: { label: string; bucket: ReportBucket };
      totals: ApiSalesTotals;
      previous: ApiSalesTotals;
      change: Record<string, number | null>;
      series: (ApiSalesTotals & { date: string; label: string })[];
    }>('/reports/sales', { ...rangeQuery(range), groupBy });
    const change = Object.fromEntries(Object.entries(r.change).filter(([, v]) => v !== null)) as SalesReport['change'];
    return { range: r.range.label, bucket: r.range.bucket, totals: r.totals, previous: r.previous, change, series: r.series.map(salesPoint) };
  },

  /** GET /admin/reports/products — server-filtered, sorted and paginated. */
  async getProductReport(range: DateRange, filters: ProductReportFilters = {}): Promise<ProductReport> {
    const r = await adminApi.get<{ totals: ProductReport['totals'] & { conversion: number | null }; best: ApiTopProduct[]; worst: ApiTopProduct[]; items: ApiTopProduct[]; total: number }>(
      '/reports/products',
      {
        ...rangeQuery(range),
        category: filters.categoryId,
        brand: filters.brandId,
        sport: filters.sport,
        search: filters.search,
        status: filters.status ? filters.status.toUpperCase() : undefined,
        sort: filters.sort,
        order: filters.order,
        page: filters.page ?? 1,
        limit: filters.pageSize ?? 50,
      },
    );
    return {
      totals: { ...r.totals, conversion: r.totals.conversion ?? undefined },
      best: r.best.map(toTopProduct),
      worst: r.worst.map(toTopProduct),
      items: r.items.map(toTopProduct),
      total: r.total,
    };
  },

  /** GET /admin/reports/customers?range=&groupBy= */
  async getCustomerReport(range: DateRange, groupBy?: ReportBucket): Promise<CustomerReport> {
    const r = await adminApi.get<Omit<CustomerReport, 'bucket' | 'topCustomers'> & { range: { bucket: ReportBucket }; topCustomers: { id: string; name: string; email: string; orders: number; spent: number }[] }>(
      '/reports/customers',
      { ...rangeQuery(range), groupBy },
    );
    return { bucket: r.range.bucket, totals: r.totals, growth: r.growth, byCity: r.byCity, byGroup: r.byGroup.map(({ name, value }) => ({ name, value })), topCustomers: r.topCustomers };
  },

  /** GET /admin/reports/inventory — snapshot + stock movement over the range (default 3 months, weekly). */
  async getInventoryReport(range?: DateRange, groupBy?: ReportBucket): Promise<InventoryReport> {
    const r = await adminApi.get<Omit<InventoryReport, 'bucket'> & { range: { bucket: ReportBucket } }>('/reports/inventory', { ...(range ? rangeQuery(range) : {}), groupBy });
    return { bucket: r.range.bucket, totals: r.totals, aging: r.aging, movement: r.movement, topStocked: r.topStocked, byStatus: r.byStatus.map(({ name, value }) => ({ name, value })) };
  },

  /** Server-generated CSV (`?format=csv`, needs reports:export). */
  async exportReport(kind: 'sales' | 'products' | 'customers' | 'inventory', range?: DateRange, extra: Query = {}): Promise<void> {
    const query: Query = { ...(range ? rangeQuery(range) : {}), ...extra, format: 'csv' };
    const tag = kind === 'inventory' ? '' : `-${range?.preset ?? '30d'}`;
    await download(`/admin/reports/${kind}`, query, `${kind}-report${tag}-${stamp()}.csv`);
  },

  /** GET /admin/dashboard/nav-counts — sidebar badges (any staff member). */
  async getNavCounts(): Promise<NavCounts> {
    const c = await adminApi.get<{ orders: number; lowStock: number; outOfStock: number; support: number; reviews: number; refunds: number }>('/dashboard/nav-counts');
    return { orders: c.orders, lowStock: c.lowStock, support: c.support, reviews: c.reviews, refunds: c.refunds, outOfStock: c.outOfStock };
  },
};
