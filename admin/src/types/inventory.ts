import type { ID, ISODate } from './common';
import type { ProductType, StockStatus } from './catalog';

export interface InventoryItem {
  variantId: ID;
  productId: ID;
  productName: string;
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
  unitCost: number;
  /** Days since the last inbound (restock) movement — drives stock aging. */
  daysSinceRestock: number;
  updatedAt: ISODate;
}

export type StockAction = 'add' | 'remove' | 'set' | 'sale' | 'return';
export type StockReason = 'restock' | 'damaged' | 'returned' | 'manual_correction' | 'sale_adjustment' | 'other';

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
  reason: StockReason;
  notes?: string;
  adminId: ID;
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
