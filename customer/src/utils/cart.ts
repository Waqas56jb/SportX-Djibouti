import type { CartItem, CartTotals } from '@/types';

/**
 * Guest-bag ESTIMATE only (display). Signed-in customers always see the server's totals
 * (`GET /cart`, `POST /checkout/validate`). Shipping, coupons and tax are priced at checkout.
 */
export function estimateTotals(items: CartItem[], freeShippingThreshold: number | null | undefined): CartTotals {
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const savings = items.reduce((sum, i) => sum + Math.max(0, (i.compareAtPrice ?? i.unitPrice) - i.unitPrice) * i.quantity, 0);
  const threshold = freeShippingThreshold ?? null;
  return {
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    savings,
    productDiscount: 0,
    discount: 0,
    shipping: 0,
    tax: 0,
    taxInclusive: false,
    total: subtotal,
    freeShippingRemaining: threshold === null ? 0 : Math.max(0, threshold - subtotal),
    freeShippingThreshold: threshold,
    estimated: true,
  };
}

export const EMPTY_TOTALS: CartTotals = estimateTotals([], null);
