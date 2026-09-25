import type { ID, ISODate } from './common';
import type { CustomerGroup } from './customers';

export type CouponType = 'percentage' | 'fixed';
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
}

export type CouponInput = Omit<Coupon, 'id' | 'usageCount' | 'createdAt'>;

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
}

export type DiscountInput = Omit<Discount, 'id' | 'createdAt'>;

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
}

export type FlashSaleInput = Omit<FlashSale, 'id' | 'unitsSold' | 'revenue' | 'createdAt'>;

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
}

export type CampaignInput = Omit<Campaign, 'id' | 'impressions' | 'clicks' | 'revenue' | 'createdAt' | 'updatedAt'>;
