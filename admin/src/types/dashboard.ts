import type { ISODate } from './common';
import type { ProductType } from './catalog';

export interface KpiValue {
  value: number;
  previous: number;
  /** Percentage change vs previous period. */
  change: number;
  trend: number[];
}

export interface DashboardStats {
  periodLabel: string;
  revenue: KpiValue;
  orders: KpiValue;
  customers: KpiValue;
  productsSold: KpiValue;
  pendingOrders: number;
  lowStock: number;
  refundRequests: number;
  openTickets: number;
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
}

export interface CategorySales {
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
  conversion: number;
  stock: number;
  /** Percent change in units vs previous period. */
  trend: number;
}

export interface CustomerGrowthPoint {
  label: string;
  newCustomers: number;
  returningCustomers: number;
  total: number;
}
