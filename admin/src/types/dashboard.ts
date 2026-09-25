import type { ISODate } from './common';
import type { ProductStatus, ProductType } from './catalog';
import type { OrderStatus, PaymentStatus } from './orders';

export interface KpiValue {
  value: number;
  previous: number;
  /** Percentage change vs previous period; undefined when there is no baseline. */
  change?: number;
  trend: number[];
}

export interface DashboardStats {
  periodLabel: string;
  revenue: KpiValue;
  orders: KpiValue;
  customers: KpiValue;
  productsSold: KpiValue;
  /** Orders waiting on staff (PENDING / PAYMENT_CONFIRMED / PROCESSING). */
  pendingOrders: number;
  /** Low-stock variants (available > 0 and ≤ threshold). */
  lowStock: number;
  outOfStock: number;
  refundRequests: number;
  openTickets: number;
  pendingReviews: number;
  averageOrderValue: number;
}

export interface SalesPoint {
  date: ISODate;
  label: string;
  revenue: number;
  orders: number;
  aov: number;
  discounts: number;
  refunds: number;
  netSales: number;
  grossSales?: number;
  shipping?: number;
  tax?: number;
  units?: number;
  newCustomers?: number;
}

export interface CategorySales {
  categoryId?: string;
  category: string;
  revenue: number;
  units: number;
  share: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  productType: ProductType;
  category: string;
  brand: string;
  unitsSold: number;
  revenue: number;
  views: number;
  /** Units sold ÷ lifetime views, in percent (0 when there are no views yet). */
  conversion: number;
  stock: number;
  /** Percent change in units vs previous period (0 when there is no baseline). */
  trend: number;
  image?: string;
  sku?: string;
  sport?: string;
  status?: ProductStatus;
}

export interface CustomerGrowthPoint {
  label: string;
  newCustomers: number;
  returningCustomers: number;
  total: number;
  buyers?: number;
}

/** Order row on the dashboard "Recent orders" panel. */
export interface RecentOrder {
  id: string;
  number: string;
  customerName: string;
  itemsCount: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  image?: string;
  createdAt: ISODate;
}

/** Everything the dashboard renders, from one GET /admin/dashboard call. */
export interface DashboardData {
  range: { preset: string; label: string; bucket: 'hour' | 'day' | 'week' | 'month'; from: ISODate; to: ISODate };
  stats: DashboardStats;
  salesChart: SalesPoint[];
  salesByCategory: CategorySales[];
  topProducts: TopProduct[];
  recentOrders: RecentOrder[];
}

export type NavCounts = Record<'orders' | 'lowStock' | 'support' | 'reviews' | 'refunds', number> & { outOfStock?: number };
