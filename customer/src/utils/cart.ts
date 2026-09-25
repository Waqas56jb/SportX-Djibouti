import { FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS } from '@/constants/commerce';
import type { CartItem, CartTotals, Coupon } from '@/types';

export function couponDiscount(coupon: Coupon | null, subtotal: number) {
  if (!coupon) return 0;
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) return 0;
  const raw = coupon.type === 'percentage' ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  return Math.min(raw, subtotal);
}

/**
 * Pure totals calculation shared by the cart drawer, cart page and checkout.
 * `shippingPrice` is the selected method's price; `undefined` means estimate.
 */
export function calculateTotals(items: CartItem[], coupon: Coupon | null, shippingPrice?: number): CartTotals {
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const savings = items.reduce((sum, i) => sum + Math.max(0, (i.compareAtPrice ?? i.unitPrice) - i.unitPrice) * i.quantity, 0);
  const discount = couponDiscount(coupon, subtotal);
  const qualifiesFree = subtotal - discount >= FREE_SHIPPING_THRESHOLD;
  const estimate = shippingPrice ?? SHIPPING_METHODS[0].price;
  const shipping = items.length === 0 || qualifiesFree ? 0 : estimate;
  return {
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    savings,
    discount,
    shipping,
    total: Math.max(0, subtotal - discount + shipping),
    freeShippingRemaining: Math.max(0, FREE_SHIPPING_THRESHOLD - (subtotal - discount)),
  };
}
