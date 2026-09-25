import type {
  Coupon,
  CouponInput,
  CouponType,
  CouponUsage,
  CustomerGroup,
  Discount,
  DiscountInput,
  FlashSale,
  FlashSaleInput,
  FlashSaleStatus,
  MarketingBrand,
  MarketingCategory,
  MarketingPage,
  MarketingProduct,
  PromotionStatus,
} from '@/types';
import { adminApi, type PageResult, type Query } from './api';

export type { FlashSaleStatus } from '@/types';

/**
 * Coupons, automatic discounts and flash sales — /api/v1/admin/{coupons,discounts,flash-sales}.
 * The API speaks UPPER_SNAKE enums (PERCENTAGE / FIXED, PRODUCTS …) and integer DJF; this adapter
 * maps to the admin's lower-case types. Nullable API fields become `undefined`.
 */

// ─── Client-side status helpers (used for live countdowns between refreshes) ───────────────
export function promotionStatus(p: { enabled: boolean; startsAt: string; endsAt?: string; usageLimit?: number; usageCount?: number }): PromotionStatus {
  if (!p.enabled) return 'disabled';
  const t = Date.now();
  if (p.endsAt && new Date(p.endsAt).getTime() <= t) return 'expired';
  if (p.usageLimit !== undefined && p.usageCount !== undefined && p.usageCount >= p.usageLimit) return 'expired';
  if (new Date(p.startsAt).getTime() > t) return 'scheduled';
  return 'active';
}

export function flashSaleStatus(f: Pick<FlashSale, 'enabled' | 'startsAt' | 'endsAt'>): FlashSaleStatus {
  if (!f.enabled) return 'disabled';
  const t = Date.now();
  if (new Date(f.startsAt).getTime() > t) return 'upcoming';
  if (new Date(f.endsAt).getTime() <= t) return 'ended';
  return 'active';
}

// ─── Shared mapping ───────────────────────────────────────────────────────────────────────
type ApiDiscountType = 'PERCENTAGE' | 'FIXED';
const toType = (t: string): CouponType => (t?.toUpperCase() === 'FIXED' ? 'fixed' : 'percentage');
const fromType = (t: CouponType): ApiDiscountType => (t === 'fixed' ? 'FIXED' : 'PERCENTAGE');
const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);
const lower = <T extends string>(v: string | null | undefined): T | undefined => (v ? (v.toLowerCase() as T) : undefined);

export type SortOrder = 'asc' | 'desc';

interface ListParams<S extends string, St extends string> {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: St;
  sort?: S;
  order?: SortOrder;
  signal?: AbortSignal;
}

function listQuery<S extends string, St extends string>(p: ListParams<S, St>, extra: Query = {}): Query {
  return { page: p.page ?? 1, limit: p.pageSize ?? 20, search: p.search?.trim() || undefined, status: p.status, sort: p.sort, order: p.order, ...extra };
}

function toPage<A, T>(r: PageResult<A>, map: (a: A) => T): MarketingPage<T> {
  return { items: r.data.map(map), page: r.pagination.page, pageSize: r.pagination.limit, total: r.pagination.total, totalPages: r.pagination.totalPages };
}

/** Totals per status via `limit=1` requests (the list endpoints don't return counts). */
async function countByStatus<St extends string>(path: string, statuses: readonly St[]): Promise<Record<St | 'all', number>> {
  const all = [undefined, ...statuses] as (St | undefined)[];
  const totals = await Promise.all(all.map((status) => adminApi.page<unknown>(path, { page: 1, limit: 1, status }).then((r) => r.pagination.total)));
  const out = {} as Record<St | 'all', number>;
  all.forEach((s, i) => (out[(s ?? 'all') as St | 'all'] = totals[i]));
  return out;
}

// ─── Coupons ──────────────────────────────────────────────────────────────────────────────
interface ApiCoupon {
  id: string;
  code: string;
  description: string;
  type: ApiDiscountType;
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usageCount: number;
  discountTotal: number;
  startsAt: string;
  endsAt: string | null;
  enabled: boolean;
  status: string;
  categoryIds: string[];
  productIds: string[];
  customerGroups: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const toCoupon = (c: ApiCoupon): Coupon => ({
  id: c.id,
  code: c.code,
  description: c.description ?? '',
  type: toType(c.type),
  value: c.value,
  minOrder: c.minOrder ?? 0,
  maxDiscount: opt(c.maxDiscount),
  usageLimit: opt(c.usageLimit),
  perCustomerLimit: opt(c.perCustomerLimit),
  usageCount: c.usageCount ?? 0,
  discountTotal: c.discountTotal ?? 0,
  startsAt: c.startsAt,
  endsAt: opt(c.endsAt),
  enabled: c.enabled,
  status: lower<PromotionStatus>(c.status),
  categoryIds: c.categoryIds ?? [],
  productIds: c.productIds ?? [],
  customerGroups: (c.customerGroups ?? []) as CustomerGroup[],
  createdBy: c.createdBy,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

/** Full-form body. Optional limits are sent as `null` so clearing a field clears it server-side. */
const couponBody = (i: CouponInput) => ({
  code: i.code.trim().toUpperCase(),
  description: i.description.trim(),
  type: fromType(i.type),
  value: i.value,
  minOrder: i.minOrder || 0,
  maxDiscount: i.type === 'percentage' ? (i.maxDiscount ?? null) : null,
  usageLimit: i.usageLimit ?? null,
  perCustomerLimit: i.perCustomerLimit ?? null,
  startsAt: i.startsAt,
  endsAt: i.endsAt ?? null,
  enabled: i.enabled,
  categoryIds: i.categoryIds,
  productIds: i.productIds,
  customerGroups: i.customerGroups.filter((g) => g !== 'all'),
});

export type CouponSort = 'created_at' | 'code' | 'usage_count' | 'starts_at' | 'ends_at' | 'value';
export type CouponListParams = ListParams<CouponSort, PromotionStatus> & { type?: CouponType };
export type PromotionCounts = Record<PromotionStatus | 'all', number>;

// ─── Automatic discounts ─────────────────────────────────────────────────────────────────
interface ApiDiscount {
  id: string;
  name: string;
  type: ApiDiscountType;
  value: number;
  appliesTo: 'ALL' | 'PRODUCTS' | 'CATEGORIES' | 'BRANDS';
  targetIds: string[];
  targets: { id: string; name: string }[];
  startsAt: string;
  endsAt: string | null;
  enabled: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const toDiscount = (d: ApiDiscount): Discount => ({
  id: d.id,
  name: d.name,
  type: toType(d.type),
  value: d.value,
  appliesTo: (lower<Discount['appliesTo']>(d.appliesTo) ?? 'all'),
  targetIds: d.targetIds ?? [],
  targets: d.targets ?? [],
  startsAt: d.startsAt,
  endsAt: opt(d.endsAt),
  enabled: d.enabled,
  status: lower<PromotionStatus>(d.status),
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

const discountBody = (i: DiscountInput) => ({
  name: i.name.trim(),
  type: fromType(i.type),
  value: i.value,
  appliesTo: i.appliesTo.toUpperCase(),
  targetIds: i.appliesTo === 'all' ? [] : i.targetIds,
  startsAt: i.startsAt,
  endsAt: i.endsAt ?? null,
  enabled: i.enabled,
});

export type DiscountSort = 'created_at' | 'name' | 'starts_at' | 'ends_at' | 'value';
export type DiscountListParams = ListParams<DiscountSort, PromotionStatus> & { appliesTo?: Discount['appliesTo'] };

// ─── Flash sales ─────────────────────────────────────────────────────────────────────────
interface ApiFlashSale {
  id: string;
  name: string;
  discountPercent: number;
  productIds: string[];
  products: { id: string; name: string; price: number; image: string | null }[];
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  status: string;
  unitsSold: number;
  revenue: number;
  orders: number;
  createdAt: string;
  updatedAt: string;
}

const toFlashSale = (f: ApiFlashSale): FlashSale => ({
  id: f.id,
  name: f.name,
  discountPercent: f.discountPercent,
  productIds: f.productIds ?? [],
  products: (f.products ?? []).map((p) => ({ id: p.id, name: p.name, price: p.price, image: opt(p.image) })),
  startsAt: f.startsAt,
  endsAt: f.endsAt,
  enabled: f.enabled,
  status: lower<FlashSaleStatus>(f.status),
  unitsSold: f.unitsSold ?? 0,
  revenue: Number(f.revenue ?? 0),
  orders: f.orders ?? 0,
  createdAt: f.createdAt,
  updatedAt: f.updatedAt,
});

const flashSaleBody = (i: FlashSaleInput) => ({
  name: i.name.trim(),
  discountPercent: i.discountPercent,
  productIds: i.productIds,
  startsAt: i.startsAt,
  endsAt: i.endsAt,
  enabled: i.enabled,
});

export type FlashSaleSort = 'starts_at' | 'ends_at' | 'created_at' | 'name' | 'discount_percent';
export type FlashSaleListParams = ListParams<FlashSaleSort, FlashSaleStatus>;
export type FlashSaleCounts = Record<FlashSaleStatus | 'all', number>;

// ─── Catalogue lookups for marketing pickers (read-only) ─────────────────────────────────
export interface MarketingCatalogData {
  products: MarketingProduct[];
  categories: MarketingCategory[];
  brands: MarketingBrand[];
}

interface ApiProductRow {
  id: string;
  name: string;
  sku: string;
  price: number;
  image: string | null;
  brandName: string | null;
  totalStock: number | null;
}

async function allProducts(): Promise<MarketingProduct[]> {
  const out: MarketingProduct[] = [];
  const MAX_PAGES = 20; // 2,000 products — plenty for a pick list
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await adminApi.page<ApiProductRow>('/products', { page, limit: 100, sort: 'name', order: 'asc' });
    out.push(...r.data.map((p) => ({ id: p.id, name: p.name, sku: p.sku, price: p.price, image: opt(p.image), brandName: opt(p.brandName), totalStock: opt(p.totalStock) })));
    if (!r.pagination.hasNext) break;
  }
  return out;
}

const PROMO_STATUSES: readonly PromotionStatus[] = ['active', 'scheduled', 'expired', 'disabled'];
const FLASH_STATUSES: readonly FlashSaleStatus[] = ['active', 'upcoming', 'ended', 'disabled'];

export const discountService = {
  // ─── Coupons ────────────────────────────────────────────────────────────
  /** GET /admin/coupons — server paging, search (code/description), status, type, sort. Includes global status counts. */
  async getCoupons(p: CouponListParams = {}): Promise<MarketingPage<Coupon> & { counts: PromotionCounts }> {
    const r = await adminApi.page<ApiCoupon, { counts?: Partial<PromotionCounts> }>('/coupons', listQuery(p, { type: p.type ? fromType(p.type) : undefined }), p.signal);
    const c = r.counts ?? {};
    return { ...toPage(r, toCoupon), counts: { all: c.all ?? 0, active: c.active ?? 0, scheduled: c.scheduled ?? 0, expired: c.expired ?? 0, disabled: c.disabled ?? 0 } };
  },

  /** GET /admin/coupons/:id */
  async getCoupon(id: string): Promise<Coupon> {
    return toCoupon(await adminApi.get<ApiCoupon>(`/coupons/${id}`));
  },

  /** GET /admin/coupons/:id/usages */
  async getCouponUsages(id: string, p: { page?: number; pageSize?: number } = {}): Promise<MarketingPage<CouponUsage>> {
    const r = await adminApi.page<CouponUsage>(`/coupons/${id}/usages`, { page: p.page ?? 1, limit: p.pageSize ?? 10 });
    return toPage(r, (u) => u);
  },

  /** POST /admin/coupons */
  async createCoupon(input: CouponInput): Promise<Coupon> {
    return toCoupon(await adminApi.post<ApiCoupon>('/coupons', couponBody(input)));
  },

  /** PUT /admin/coupons/:id (full form) */
  async updateCoupon(id: string, input: CouponInput): Promise<Coupon> {
    return toCoupon(await adminApi.put<ApiCoupon>(`/coupons/${id}`, couponBody(input)));
  },

  /** PATCH /admin/coupons/:id { enabled } */
  async setCouponEnabled(id: string, enabled: boolean): Promise<Coupon> {
    return toCoupon(await adminApi.patch<ApiCoupon>(`/coupons/${id}`, { enabled }));
  },

  /** DELETE /admin/coupons/:id (soft delete — usage history is kept). */
  async deleteCoupon(id: string): Promise<void> {
    await adminApi.delete(`/coupons/${id}`);
  },

  // ─── Automatic discounts ───────────────────────────────────────────────
  /** GET /admin/discounts */
  async getDiscounts(p: DiscountListParams = {}): Promise<MarketingPage<Discount>> {
    const r = await adminApi.page<ApiDiscount>('/discounts', listQuery(p, { appliesTo: p.appliesTo?.toUpperCase() }), p.signal);
    return toPage(r, toDiscount);
  },

  /** Totals per derived status (all / active / scheduled / expired / disabled). */
  getDiscountCounts: (): Promise<PromotionCounts> => countByStatus('/discounts', PROMO_STATUSES),

  /** GET /admin/discounts/:id */
  async getDiscount(id: string): Promise<Discount> {
    return toDiscount(await adminApi.get<ApiDiscount>(`/discounts/${id}`));
  },

  /** POST /admin/discounts */
  async createDiscount(input: DiscountInput): Promise<Discount> {
    return toDiscount(await adminApi.post<ApiDiscount>('/discounts', discountBody(input)));
  },

  /** PUT /admin/discounts/:id */
  async updateDiscount(id: string, input: DiscountInput): Promise<Discount> {
    return toDiscount(await adminApi.put<ApiDiscount>(`/discounts/${id}`, discountBody(input)));
  },

  /** PATCH /admin/discounts/:id { enabled } */
  async setDiscountEnabled(id: string, enabled: boolean): Promise<Discount> {
    return toDiscount(await adminApi.patch<ApiDiscount>(`/discounts/${id}`, { enabled }));
  },

  /** DELETE /admin/discounts/:id */
  async deleteDiscount(id: string): Promise<void> {
    await adminApi.delete(`/discounts/${id}`);
  },

  // ─── Flash sales ───────────────────────────────────────────────────────
  /** GET /admin/flash-sales */
  async getFlashSales(p: FlashSaleListParams = {}): Promise<MarketingPage<FlashSale>> {
    const r = await adminApi.page<ApiFlashSale>('/flash-sales', listQuery(p), p.signal);
    return toPage(r, toFlashSale);
  },

  /** Totals per status (all / active / upcoming / ended / disabled). */
  getFlashSaleCounts: (): Promise<FlashSaleCounts> => countByStatus('/flash-sales', FLASH_STATUSES),

  /** GET /admin/flash-sales/:id */
  async getFlashSale(id: string): Promise<FlashSale> {
    return toFlashSale(await adminApi.get<ApiFlashSale>(`/flash-sales/${id}`));
  },

  /** POST /admin/flash-sales */
  async createFlashSale(input: FlashSaleInput): Promise<FlashSale> {
    return toFlashSale(await adminApi.post<ApiFlashSale>('/flash-sales', flashSaleBody(input)));
  },

  /** PUT /admin/flash-sales/:id */
  async updateFlashSale(id: string, input: FlashSaleInput): Promise<FlashSale> {
    return toFlashSale(await adminApi.put<ApiFlashSale>(`/flash-sales/${id}`, flashSaleBody(input)));
  },

  /** PATCH /admin/flash-sales/:id { enabled } */
  async setFlashSaleEnabled(id: string, enabled: boolean): Promise<FlashSale> {
    return toFlashSale(await adminApi.patch<ApiFlashSale>(`/flash-sales/${id}`, { enabled }));
  },

  /** DELETE /admin/flash-sales/:id */
  async deleteFlashSale(id: string): Promise<void> {
    await adminApi.delete(`/flash-sales/${id}`);
  },

  // ─── Lookups ───────────────────────────────────────────────────────────
  /**
   * Products, categories and brands for marketing pickers. Each source fails independently
   * (e.g. a role without products:view) so the editors still open.
   */
  async getMarketingCatalog(): Promise<MarketingCatalogData> {
    const [products, categories, brands] = await Promise.allSettled([
      allProducts(),
      adminApi.get<{ id: string; name: string; parentId: string | null }[]>('/categories'),
      adminApi.get<{ id: string; name: string }[]>('/brands'),
    ]);
    return {
      products: products.status === 'fulfilled' ? products.value : [],
      categories: categories.status === 'fulfilled' ? categories.value.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })) : [],
      brands: brands.status === 'fulfilled' ? brands.value.map((b) => ({ id: b.id, name: b.name })) : [],
    };
  },
};
