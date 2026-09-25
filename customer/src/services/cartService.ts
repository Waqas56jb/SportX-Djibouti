import type { CartIssue, CartIssueCode, CartIssueType, CartItem, CartLineStatus, CartTotals, Coupon } from '@/types';
import { api } from './api';

// ───────────────────────── API shapes ─────────────────────────

export interface ApiCartLine {
  id: string;
  productId: string;
  variantId: string;
  slug: string | null;
  name: string;
  brand: string | null;
  image: string | null;
  sku: string | null;
  color: string | null;
  colorHex: string | null;
  size: string | null;
  quantity: number;
  unitPrice: number | null;
  originalUnitPrice: number | null;
  compareAtPrice: number | null;
  unitDiscount: number;
  lineTotal: number;
  available: number;
  maxStock: number;
  status: CartLineStatus;
}

export interface ApiPriceIssue {
  itemId?: string | null;
  variantId: string;
  type: CartIssueCode;
  message: string;
  available?: number;
  newUnitPrice?: number;
  /** Merge issues. */
  requested?: number;
  quantity?: number;
}

export interface ApiCoupon {
  code: string;
  valid: boolean;
  message: string;
  discount: number;
  type?: 'PERCENTAGE' | 'FIXED' | string;
  value?: number;
  description?: string;
}

/** `PriceBreakdown.totals`. */
export interface ApiTotals {
  itemCount: number;
  subtotal: number;
  productDiscount: number;
  merchandiseTotal: number;
  couponDiscount: number;
  shipping: number;
  tax: number;
  taxInclusive: boolean;
  grandTotal: number;
  savings: number;
  freeShippingThreshold: number | null;
  freeShippingRemaining: number;
}

export interface ApiCart {
  id: string | null;
  currency: string;
  items: ApiCartLine[];
  issues: ApiPriceIssue[];
  coupon: ApiCoupon | null;
  totals: ApiTotals;
  mergeIssues?: ApiPriceIssue[];
}

/** The signed-in customer's server cart, adapted to UI types. The server is the source of truth. */
export interface ServerCart {
  id: string | null;
  items: CartItem[];
  issues: CartIssue[];
  coupon: Coupon | null;
  totals: CartTotals;
}

// ───────────────────────── Adapters ─────────────────────────

const ISSUE_TYPE: Record<string, CartIssueType> = {
  UNAVAILABLE: 'removed',
  INACTIVE: 'removed',
  OUT_OF_STOCK: 'out-of-stock',
  INSUFFICIENT_STOCK: 'stock-reduced',
  QUANTITY_LIMIT: 'stock-reduced',
  QUANTITY_REDUCED: 'stock-reduced',
  PRICE_CHANGED: 'price-changed',
};

export function toCartIssue(i: ApiPriceIssue, itemId?: string | null): CartIssue {
  return {
    itemId: itemId ?? i.itemId ?? i.variantId,
    variantId: i.variantId,
    type: ISSUE_TYPE[i.type] ?? 'removed',
    code: i.type,
    message: i.message,
    availableStock: i.available ?? i.quantity,
    newPrice: i.newUnitPrice,
  };
}

export function toCoupon(c: ApiCoupon | null | undefined): Coupon | null {
  if (!c) return null;
  return {
    code: c.code,
    description: c.description ?? c.message ?? '',
    type: c.type === 'PERCENTAGE' ? 'percentage' : c.type === 'FIXED' ? 'fixed' : (c.type ?? 'fixed').toLowerCase(),
    value: c.value ?? 0,
    discount: c.discount,
    valid: c.valid,
    message: c.message,
  };
}

export function toCartTotals(t: ApiTotals): CartTotals {
  return {
    itemCount: t.itemCount,
    subtotal: t.subtotal,
    savings: t.savings,
    productDiscount: t.productDiscount,
    discount: t.couponDiscount,
    shipping: t.shipping,
    tax: t.tax,
    taxInclusive: t.taxInclusive,
    total: t.grandTotal,
    freeShippingRemaining: t.freeShippingRemaining,
    freeShippingThreshold: t.freeShippingThreshold,
    estimated: false,
  };
}

export function toCartItem(l: ApiCartLine): CartItem {
  const unit = l.unitPrice ?? 0;
  const higher = Math.max(l.compareAtPrice ?? 0, l.originalUnitPrice ?? 0);
  return {
    id: l.id,
    productId: l.productId,
    variantId: l.variantId,
    slug: l.slug ?? '',
    name: l.name,
    brand: l.brand ?? '',
    image: l.image ?? '',
    color: l.color ?? '',
    size: l.size ?? '',
    unitPrice: unit,
    compareAtPrice: higher > unit ? higher : undefined,
    quantity: l.quantity,
    maxStock: l.maxStock,
    lineTotal: l.lineTotal,
    status: l.status,
  };
}

export function toServerCart(c: ApiCart): ServerCart {
  const issues = [...(c.issues ?? []), ...(c.mergeIssues ?? [])].map((i) => toCartIssue(i, i.itemId ?? c.items.find((x) => x.variantId === i.variantId)?.id));
  return { id: c.id, items: c.items.map(toCartItem), issues, coupon: toCoupon(c.coupon), totals: toCartTotals(c.totals) };
}

// ───────────────────────── Endpoints (signed-in only) ─────────────────────────

export const cartService = {
  get: async () => toServerCart(await api.get<ApiCart>('/cart')),

  addItem: async (variantId: string, quantity: number) => toServerCart(await api.post<ApiCart>('/cart/items', { variantId, quantity })),

  /** Quantity 0 removes the line. */
  updateItem: async (itemId: string, quantity: number) => toServerCart(await api.patch<ApiCart>(`/cart/items/${itemId}`, { quantity })),

  removeItem: async (itemId: string) => toServerCart(await api.delete<ApiCart>(`/cart/items/${itemId}`)),

  clear: async () => toServerCart(await api.delete<ApiCart>('/cart')),

  /** Merges the guest bag after sign-in (larger quantity wins; clamped to stock). */
  merge: async (items: { variantId: string; quantity: number }[]) => toServerCart(await api.post<ApiCart>('/cart/merge', { items: items.slice(0, 50) })),

  /** Validates and stores the code on the server cart; throws `ApiError` (INVALID_COUPON) with a friendly message. */
  applyCoupon: async (code: string) => toServerCart(await api.post<ApiCart>('/cart/coupon', { code: code.trim() })),

  removeCoupon: async () => toServerCart(await api.delete<ApiCart>('/cart/coupon')),
};
