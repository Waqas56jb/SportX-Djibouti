import type { ProductVariant, StockStatus } from '@/types';

export function variantStockStatus(v: Pick<ProductVariant, 'stock' | 'reserved' | 'lowStockThreshold'>): StockStatus {
  const available = v.stock - v.reserved;
  if (v.stock <= 0 || available <= 0) return 'out_of_stock';
  if (v.stock <= v.lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

/** Product-level status: out if every variant is out, low if any variant is low/out, else in stock. */
export function productStockStatus(variants: Pick<ProductVariant, 'stock' | 'reserved' | 'lowStockThreshold'>[]): StockStatus {
  if (variants.length === 0) return 'out_of_stock';
  const statuses = variants.map(variantStockStatus);
  if (statuses.every((s) => s === 'out_of_stock')) return 'out_of_stock';
  if (statuses.some((s) => s !== 'in_stock')) return 'low_stock';
  return 'in_stock';
}

export const totalStock = (variants: Pick<ProductVariant, 'stock'>[]) => variants.reduce((s, v) => s + v.stock, 0);
