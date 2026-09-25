/** Server line status: OK when purchasable, otherwise the blocking issue. */
export type CartLineStatus = 'OK' | 'UNAVAILABLE' | 'INACTIVE' | 'OUT_OF_STOCK';

export interface CartItem {
  /**
   * Line id. Guest bag: the variant id (identical variants merge).
   * Signed-in bag: the server `cart_items.id`.
   */
  id: string;
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  brand: string;
  image: string;
  color: string;
  size: string;
  /** Guest bag: display estimate. Signed-in bag: server price. */
  unitPrice: number;
  compareAtPrice?: number;
  quantity: number;
  /** Most units this line can hold (stock and per-line limit). */
  maxStock: number;
  /** Server-computed line total (signed-in bag only). */
  lineTotal?: number;
  status?: CartLineStatus;
}

export interface Coupon {
  code: string;
  description: string;
  type: 'percentage' | 'fixed' | 'free_shipping' | (string & {});
  value: number;
  minSubtotal?: number;
  /** Discount the server applied for this code. */
  discount?: number;
  valid?: boolean;
  message?: string;
}

export interface CartTotals {
  itemCount: number;
  /** Sum of line prices before product promotions (server) / estimate (guest). */
  subtotal: number;
  /** Savings from compare-at prices / promotions (already reflected in the price). */
  savings: number;
  /** Automatic product promotions (flash sales, discounts). */
  productDiscount: number;
  /** Coupon discount. */
  discount: number;
  shipping: number;
  tax: number;
  taxInclusive: boolean;
  total: number;
  freeShippingRemaining: number;
  freeShippingThreshold: number | null;
  /** True for the guest bag: totals are a local estimate, the server prices at checkout. */
  estimated: boolean;
}

export interface Cart {
  items: CartItem[];
  coupon: Coupon | null;
  totals: CartTotals;
}

export type CartIssueType = 'removed' | 'out-of-stock' | 'stock-reduced' | 'price-changed';

/** Raw server issue code (PriceIssue / MergeIssue). */
export type CartIssueCode =
  | 'UNAVAILABLE'
  | 'INACTIVE'
  | 'OUT_OF_STOCK'
  | 'INSUFFICIENT_STOCK'
  | 'QUANTITY_LIMIT'
  | 'PRICE_CHANGED'
  | 'QUANTITY_REDUCED';

export interface CartIssue {
  itemId: string;
  variantId?: string;
  type: CartIssueType;
  code?: CartIssueCode | (string & {});
  message: string;
  availableStock?: number;
  newPrice?: number;
}

export interface WishlistItem {
  productId: string;
  addedAt: string;
}
