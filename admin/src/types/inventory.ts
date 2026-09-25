import type { ID, ISODate } from './common';
import type { ProductType, StockStatus } from './catalog';

export interface InventoryItem {
  variantId: ID;
  productId: ID;
  productName: string;
  productSku?: string;
  productType: ProductType;
  productImage?: string;
  variantLabel: string;
  color: string;
  colorHex: string;
  size: string;
  sku: string;
  stock: number;
  reserved: number;
  available: number;
  threshold: number;
  status: StockStatus;
  /** Product cost price; 0 when the product has no cost price set. */
  unitCost: number;
  /** Selling price (variant override or product price). */
  price?: number;
  /** Days since the last inbound (restock) movement — drives stock aging. */
  daysSinceRestock: number;
  lastRestockedAt?: ISODate;
  updatedAt: ISODate;
}

/** Inventory counts for the current (non-status) filters — drives the tabs and headline strip. */
export interface InventorySummaryCounts {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  units: number;
  reserved: number;
}

export type StockAction = 'add' | 'remove' | 'set' | 'sale' | 'return';
/** UI adjustment reasons (mapped to the API's RESTOCK | MANUAL_ADJUSTMENT | DAMAGED | RETURNED | OTHER). */
export type StockReason = 'restock' | 'damaged' | 'returned' | 'manual_correction' | 'sale_adjustment' | 'other';
/** Every reason a movement can carry on the API (manual + order-driven). */
export type MovementReason = 'RESTOCK' | 'MANUAL_ADJUSTMENT' | 'DAMAGED' | 'RETURNED' | 'ORDER' | 'ORDER_CANCELLED' | 'REFUND' | 'OTHER';

export interface StockMovement {
  id: ID;
  variantId: ID;
  productId: ID;
  productName: string;
  variantLabel: string;
  sku: string;
  action: StockAction;
  /** Signed delta applied to stock. */
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: MovementReason;
  notes?: string;
  orderId?: ID;
  orderNumber?: string;
  adminId?: ID;
  adminName: string;
  createdAt: ISODate;
}

export interface StockAdjustmentInput {
  variantId: ID;
  mode: 'add' | 'remove' | 'set';
  quantity: number;
  reason: StockReason;
  notes?: string;
}
