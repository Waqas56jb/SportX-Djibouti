import type { InventoryItem, MovementReason, StockAction } from '@/types';
import type { StatusMeta } from '@/constants/status';
import { PRODUCT_TYPES, labelOf } from '@/constants/catalog';
import { formatDateTime } from '@/utils/format';
import type { CsvColumn } from '@/utils/csv';
import type { StockMovement } from '@/types';

export const STOCK_ACTION: Record<StockAction, StatusMeta> = {
  add: { label: 'Add', tone: 'success' },
  remove: { label: 'Remove', tone: 'danger' },
  set: { label: 'Set', tone: 'info' },
  sale: { label: 'Sale', tone: 'neutral' },
  return: { label: 'Return', tone: 'warning' },
};

export type AdjustMode = 'add' | 'remove' | 'set';

/** Labels for every API movement reason (manual adjustments + order-driven changes). */
export const MOVEMENT_REASONS: { value: MovementReason; label: string }[] = [
  { value: 'RESTOCK', label: 'Restock' },
  { value: 'MANUAL_ADJUSTMENT', label: 'Manual adjustment' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'ORDER', label: 'Order (sale)' },
  { value: 'ORDER_CANCELLED', label: 'Order cancelled' },
  { value: 'REFUND', label: 'Refund restock' },
  { value: 'OTHER', label: 'Other' },
];

export const INVENTORY_CSV: CsvColumn<InventoryItem>[] = [
  { header: 'Product', value: (r) => r.productName },
  { header: 'Type', value: (r) => labelOf(PRODUCT_TYPES, r.productType) },
  { header: 'Variant', value: (r) => r.variantLabel },
  { header: 'SKU', value: (r) => r.sku },
  { header: 'Stock', value: (r) => r.stock },
  { header: 'Reserved', value: (r) => r.reserved },
  { header: 'Available', value: (r) => r.available },
  { header: 'Threshold', value: (r) => r.threshold },
  { header: 'Status', value: (r) => r.status },
  { header: 'Unit cost', value: (r) => r.unitCost },
  { header: 'Stock value (cost)', value: (r) => r.unitCost * r.stock },
];

export const MOVEMENT_CSV: CsvColumn<StockMovement>[] = [
  { header: 'Date', value: (m) => formatDateTime(m.createdAt) },
  { header: 'Product', value: (m) => m.productName },
  { header: 'Variant', value: (m) => m.variantLabel },
  { header: 'SKU', value: (m) => m.sku },
  { header: 'Action', value: (m) => STOCK_ACTION[m.action].label },
  { header: 'Quantity', value: (m) => m.quantity },
  { header: 'Previous stock', value: (m) => m.previousStock },
  { header: 'New stock', value: (m) => m.newStock },
  { header: 'Reason', value: (m) => labelOf(MOVEMENT_REASONS, m.reason) },
  { header: 'Order', value: (m) => m.orderNumber ?? '' },
  { header: 'Notes', value: (m) => m.notes ?? '' },
  { header: 'Admin', value: (m) => m.adminName },
];

/** Stock level expressed relative to the low-stock threshold (2× threshold = full bar). */
export function stockFill(item: Pick<InventoryItem, 'stock' | 'threshold'>): number {
  const cap = Math.max(1, item.threshold * 2);
  return Math.min(1, Math.max(0, item.stock / cap));
}
