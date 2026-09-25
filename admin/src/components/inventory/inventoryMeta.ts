import type { InventoryItem, StockAction } from '@/types';
import type { StatusMeta } from '@/constants/status';
import { STOCK_REASONS, PRODUCT_TYPES, labelOf } from '@/constants/catalog';
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
  { header: 'Stock value', value: (r) => r.unitCost * r.stock },
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
  { header: 'Reason', value: (m) => labelOf(STOCK_REASONS, m.reason) },
  { header: 'Notes', value: (m) => m.notes ?? '' },
  { header: 'Admin', value: (m) => m.adminName },
];

/** Stock level expressed relative to the low-stock threshold (2× threshold = full bar). */
export function stockFill(item: Pick<InventoryItem, 'stock' | 'threshold'>): number {
  const cap = Math.max(1, item.threshold * 2);
  return Math.min(1, Math.max(0, item.stock / cap));
}
