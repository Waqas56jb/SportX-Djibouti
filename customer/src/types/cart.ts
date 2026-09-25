export interface CartItem {
  /** Stable line id — equals the variant id so identical variants merge. */
  id: string;
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  brand: string;
  image: string;
  color: string;
  size: string;
  unitPrice: number;
  compareAtPrice?: number;
  quantity: number;
  maxStock: number;
}

export interface Coupon {
  code: string;
  description: string;
  type: 'percentage' | 'fixed';
  value: number;
  minSubtotal?: number;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  /** Savings from compare-at prices (already reflected in subtotal). */
  savings: number;
  discount: number;
  shipping: number;
  total: number;
  freeShippingRemaining: number;
}

export interface Cart {
  items: CartItem[];
  coupon: Coupon | null;
  totals: CartTotals;
}

export type CartIssueType = 'removed' | 'out-of-stock' | 'stock-reduced' | 'price-changed';

export interface CartIssue {
  itemId: string;
  type: CartIssueType;
  message: string;
  availableStock?: number;
  newPrice?: number;
}

export interface WishlistItem {
  productId: string;
  addedAt: string;
}
