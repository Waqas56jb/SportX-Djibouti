import type { ID, ISODate } from './common';
import type { CustomerGroup } from './customers';

/** API: PERCENTAGE | FIXED (mapped to lower case by the services). Money values are integer DJF. */
export type CouponType = 'percentage' | 'fixed';
/** Derived server-side from is_active / starts_at / ends_at (+ usage limit for coupons). */
export type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'disabled';

export interface Coupon {
  id: ID;
  code: string;
  description: string;
  type: CouponType;
  value: number;
  minOrder: number;
  maxDiscount?: number;
  usageLimit?: number;
  perCustomerLimit?: number;
  usageCount: number;
  startsAt: ISODate;
  endsAt?: ISODate;
  enabled: boolean;
  categoryIds: ID[];
  productIds: ID[];
  customerGroups: CustomerGroup[];
  createdAt: ISODate;
  /** Server-derived lifecycle status. */
  status?: PromotionStatus;
  /** Total DJF discounted across all redemptions. */
  discountTotal?: number;
  createdBy?: string | null;
  updatedAt?: ISODate;
}

export type CouponInput = Omit<Coupon, 'id' | 'usageCount' | 'createdAt' | 'status' | 'discountTotal' | 'createdBy' | 'updatedAt'>;

/** GET /admin/coupons/:id/usages row. */
export interface CouponUsage {
  id: ID;
  orderId: ID;
  orderNumber: string | null;
  customerId: ID | null;
  customerName: string | null;
  email: string | null;
  discountAmount: number;
  orderTotal: number | null;
  createdAt: ISODate;
}

/** Automatic (code-less) catalogue discount. */
export interface Discount {
  id: ID;
  name: string;
  type: CouponType;
  value: number;
  appliesTo: 'all' | 'categories' | 'products' | 'brands';
  targetIds: ID[];
  startsAt: ISODate;
  endsAt?: ISODate;
  enabled: boolean;
  createdAt: ISODate;
  status?: PromotionStatus;
  /** Resolved target names (server-side). */
  targets?: { id: ID; name: string }[];
  updatedAt?: ISODate;
}

export type DiscountInput = Omit<Discount, 'id' | 'createdAt' | 'status' | 'targets' | 'updatedAt'>;

export type FlashSaleStatus = 'upcoming' | 'active' | 'ended' | 'disabled';

/** Lightweight product reference used by marketing screens (pickers, thumbnails). */
export interface MarketingProduct {
  id: ID;
  name: string;
  price: number;
  image?: string;
  sku?: string;
  brandName?: string;
  totalStock?: number;
}

export interface MarketingCategory {
  id: ID;
  name: string;
  parentId?: ID | null;
}

export interface MarketingBrand {
  id: ID;
  name: string;
}

export interface FlashSale {
  id: ID;
  name: string;
  discountPercent: number;
  productIds: ID[];
  startsAt: ISODate;
  endsAt: ISODate;
  enabled: boolean;
  unitsSold: number;
  revenue: number;
  createdAt: ISODate;
  status?: FlashSaleStatus;
  /** Products in the sale as resolved by the server (name, price, main image). */
  products?: MarketingProduct[];
  orders?: number;
  updatedAt?: ISODate;
}

export type FlashSaleInput = Omit<FlashSale, 'id' | 'unitsSold' | 'revenue' | 'createdAt' | 'status' | 'products' | 'orders' | 'updatedAt'>;

export type CampaignType = 'seasonal' | 'new_arrivals' | 'football' | 'basketball' | 'training' | 'clearance' | 'limited_release';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'archived' | 'ended';

export interface Campaign {
  id: ID;
  name: string;
  type: CampaignType;
  description: string;
  bannerUrl?: string;
  productIds: ID[];
  categoryIds: ID[];
  startsAt: ISODate;
  endsAt: ISODate;
  status: CampaignStatus;
  impressions: number;
  clicks: number;
  revenue: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** Click-through rate in percent (server-computed). */
  ctr?: number;
  unitsSold?: number;
}

/** Banner is managed separately (POST/DELETE /admin/campaigns/:id/banner). */
export type CampaignInput = Omit<Campaign, 'id' | 'impressions' | 'clicks' | 'revenue' | 'createdAt' | 'updatedAt' | 'bannerUrl' | 'ctr' | 'unitsSold'>;

/** One page of a server-paginated marketing list. */
export interface MarketingPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

