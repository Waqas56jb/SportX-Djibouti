import { COUPONS } from '@/data/mockSeed';
import { PRODUCTS } from '@/data/products';
import type { CartIssue, CartItem, Coupon } from '@/types';
import { apiClient } from './api/client';
import { USE_MOCK_API } from './config';
import { MockError, delay } from './mock/db';

/**
 * Cart persistence is client-side (localStorage) until the backend exists.
 * These calls cover the server-authoritative parts: live stock/price
 * validation and coupon lookup.
 */
export const cartService = {
  /** Re-checks every line against current inventory and pricing. */
  async validate(items: CartItem[]): Promise<CartIssue[]> {
    if (!USE_MOCK_API) return apiClient.post<CartIssue[]>('/cart/validate', { items });
    await delay(300, 600);
    const issues: CartIssue[] = [];
    items.forEach((item) => {
      const product = PRODUCTS.find((p) => p.id === item.productId);
      const variant = product?.variants.find((v) => v.id === item.variantId);
      if (!product || !variant) {
        issues.push({ itemId: item.id, type: 'removed', message: `${item.name} is no longer available.` });
        return;
      }
      if (variant.stock <= 0) {
        issues.push({ itemId: item.id, type: 'out-of-stock', message: `${item.name} (${item.size}) has sold out.`, availableStock: 0 });
      } else if (variant.stock < item.quantity) {
        issues.push({
          itemId: item.id,
          type: 'stock-reduced',
          message: `Only ${variant.stock} left of ${item.name} (${item.size}). We updated your quantity.`,
          availableStock: variant.stock,
        });
      }
      if (product.price !== item.unitPrice) {
        issues.push({ itemId: item.id, type: 'price-changed', message: `The price of ${item.name} has changed.`, newPrice: product.price });
      }
    });
    return issues;
  },

  async applyCoupon(code: string, subtotal: number): Promise<Coupon> {
    if (!USE_MOCK_API) return apiClient.post<Coupon>('/cart/coupon', { code, subtotal });
    await delay(300, 600);
    const coupon = COUPONS.find((c) => c.code === code.trim().toUpperCase());
    if (!coupon) throw new MockError('This code is not valid.');
    if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
      throw new MockError(`This code requires a minimum order value.`);
    }
    return coupon;
  },
};
