import type { Coupon, CouponInput, Discount, DiscountInput, FlashSale, FlashSaleInput, PromotionStatus } from '@/types';
import { appConfig } from '@/constants/config';
import { uid } from '@/utils/id';
import { api, ApiError } from './http';
import { audit, db, delay, matches, NotFoundError, now } from './mock/db';

/** Derived lifecycle status shared by coupons and automatic discounts. */
export function promotionStatus(p: { enabled: boolean; startsAt: string; endsAt?: string; usageLimit?: number; usageCount?: number }): PromotionStatus {
  if (!p.enabled) return 'disabled';
  const t = Date.now();
  if (p.endsAt && new Date(p.endsAt).getTime() < t) return 'expired';
  if (p.usageLimit !== undefined && p.usageCount !== undefined && p.usageCount >= p.usageLimit) return 'expired';
  if (new Date(p.startsAt).getTime() > t) return 'scheduled';
  return 'active';
}

export type FlashSaleStatus = 'upcoming' | 'active' | 'ended' | 'disabled';
export function flashSaleStatus(f: Pick<FlashSale, 'enabled' | 'startsAt' | 'endsAt'>): FlashSaleStatus {
  if (!f.enabled) return 'disabled';
  const t = Date.now();
  if (new Date(f.startsAt).getTime() > t) return 'upcoming';
  if (new Date(f.endsAt).getTime() < t) return 'ended';
  return 'active';
}

export const discountService = {
  // ─── Coupons ──────────────────────────────────────────────────────────────
  /** GET /coupons */
  async getCoupons(search?: string): Promise<Coupon[]> {
    if (!appConfig.useMocks) return api.get<Coupon[]>('/coupons', { search });
    return delay(db.coupons.filter((c) => matches([c.code, c.description], search)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  /** POST /coupons */
  async createCoupon(input: CouponInput): Promise<Coupon> {
    if (!appConfig.useMocks) return api.post<Coupon>('/coupons', input);
    const code = input.code.trim().toUpperCase();
    if (db.coupons.some((c) => c.code === code)) throw new ApiError(`Coupon code ${code} already exists.`, 409, 'code_taken');
    const coupon: Coupon = { ...input, code, id: uid('cpn'), usageCount: 0, createdAt: now() };
    db.coupons.unshift(coupon);
    audit('Coupon created', 'Marketing', coupon.code, '/discounts/coupons');
    return delay(coupon, 500);
  },

  /** PUT /coupons/:id */
  async updateCoupon(id: string, input: CouponInput): Promise<Coupon> {
    if (!appConfig.useMocks) return api.put<Coupon>(`/coupons/${id}`, input);
    const c = db.coupons.find((x) => x.id === id);
    if (!c) throw new NotFoundError('Coupon');
    const code = input.code.trim().toUpperCase();
    if (db.coupons.some((x) => x.id !== id && x.code === code)) throw new ApiError(`Coupon code ${code} already exists.`, 409, 'code_taken');
    Object.assign(c, input, { code });
    audit('Coupon updated', 'Marketing', c.code, '/discounts/coupons');
    return delay(c);
  },

  /** PATCH /coupons/:id { enabled } */
  async setCouponEnabled(id: string, enabled: boolean): Promise<Coupon> {
    if (!appConfig.useMocks) return api.patch<Coupon>(`/coupons/${id}`, { enabled });
    const c = db.coupons.find((x) => x.id === id);
    if (!c) throw new NotFoundError('Coupon');
    c.enabled = enabled;
    audit(enabled ? 'Coupon enabled' : 'Coupon disabled', 'Marketing', c.code, '/discounts/coupons');
    return delay(c, 250);
  },

  /** DELETE /coupons/:id */
  async deleteCoupon(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.delete(`/coupons/${id}`);
    const c = db.coupons.find((x) => x.id === id);
    if (!c) throw new NotFoundError('Coupon');
    db.coupons = db.coupons.filter((x) => x.id !== id);
    audit('Coupon deleted', 'Marketing', c.code);
    await delay(null);
  },

  // ─── Automatic discounts ─────────────────────────────────────────────────
  /** GET /discounts */
  async getDiscounts(): Promise<Discount[]> {
    if (!appConfig.useMocks) return api.get<Discount[]>('/discounts');
    return delay([...db.discounts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  /** POST /discounts */
  async createDiscount(input: DiscountInput): Promise<Discount> {
    if (!appConfig.useMocks) return api.post<Discount>('/discounts', input);
    const d: Discount = { ...input, id: uid('dsc'), createdAt: now() };
    db.discounts.unshift(d);
    audit('Discount created', 'Marketing', d.name, '/discounts/automatic');
    return delay(d);
  },

  /** PUT /discounts/:id */
  async updateDiscount(id: string, input: DiscountInput): Promise<Discount> {
    if (!appConfig.useMocks) return api.put<Discount>(`/discounts/${id}`, input);
    const d = db.discounts.find((x) => x.id === id);
    if (!d) throw new NotFoundError('Discount');
    Object.assign(d, input);
    audit('Discount updated', 'Marketing', d.name, '/discounts/automatic');
    return delay(d);
  },

  /** PATCH /discounts/:id { enabled } */
  async setDiscountEnabled(id: string, enabled: boolean): Promise<Discount> {
    if (!appConfig.useMocks) return api.patch<Discount>(`/discounts/${id}`, { enabled });
    const d = db.discounts.find((x) => x.id === id);
    if (!d) throw new NotFoundError('Discount');
    d.enabled = enabled;
    audit(enabled ? 'Discount enabled' : 'Discount disabled', 'Marketing', d.name, '/discounts/automatic');
    return delay(d, 250);
  },

  /** DELETE /discounts/:id */
  async deleteDiscount(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.delete(`/discounts/${id}`);
    const d = db.discounts.find((x) => x.id === id);
    if (!d) throw new NotFoundError('Discount');
    db.discounts = db.discounts.filter((x) => x.id !== id);
    audit('Discount deleted', 'Marketing', d.name);
    await delay(null);
  },

  // ─── Flash sales ─────────────────────────────────────────────────────────
  /** GET /flash-sales */
  async getFlashSales(): Promise<FlashSale[]> {
    if (!appConfig.useMocks) return api.get<FlashSale[]>('/flash-sales');
    return delay([...db.flashSales].sort((a, b) => b.startsAt.localeCompare(a.startsAt)));
  },

  /** POST /flash-sales */
  async createFlashSale(input: FlashSaleInput): Promise<FlashSale> {
    if (!appConfig.useMocks) return api.post<FlashSale>('/flash-sales', input);
    if (input.endsAt <= input.startsAt) throw new ApiError('End must be after start.', 400);
    const f: FlashSale = { ...input, id: uid('fls'), unitsSold: 0, revenue: 0, createdAt: now() };
    db.flashSales.unshift(f);
    audit('Flash sale created', 'Marketing', f.name, '/discounts/flash-sales');
    return delay(f, 500);
  },

  /** PUT /flash-sales/:id */
  async updateFlashSale(id: string, input: FlashSaleInput): Promise<FlashSale> {
    if (!appConfig.useMocks) return api.put<FlashSale>(`/flash-sales/${id}`, input);
    const f = db.flashSales.find((x) => x.id === id);
    if (!f) throw new NotFoundError('Flash sale');
    Object.assign(f, input);
    audit('Flash sale updated', 'Marketing', f.name, '/discounts/flash-sales');
    return delay(f);
  },

  /** DELETE /flash-sales/:id */
  async deleteFlashSale(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.delete(`/flash-sales/${id}`);
    const f = db.flashSales.find((x) => x.id === id);
    if (!f) throw new NotFoundError('Flash sale');
    db.flashSales = db.flashSales.filter((x) => x.id !== id);
    audit('Flash sale deleted', 'Marketing', f.name);
    await delay(null);
  },
};
