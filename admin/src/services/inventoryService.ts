import type { InventoryItem, StockAdjustmentInput, StockMovement, StockStatus } from '@/types';
import { appConfig } from '@/constants/config';
import { variantStockStatus } from '@/utils/stock';
import { uid } from '@/utils/id';
import { api, ApiError } from './http';
import { audit, db, delay, getActor, matches, NotFoundError, now } from './mock/db';

export interface InventoryFilters {
  search?: string;
  status?: StockStatus | '';
  productId?: string;
  productType?: string;
}

export interface MovementFilters {
  search?: string;
  action?: StockMovement['action'] | '';
  adminId?: string;
  productId?: string;
  variantId?: string;
  from?: string;
  to?: string;
}

function buildItems(): InventoryItem[] {
  const items: InventoryItem[] = [];
  for (const p of db.products) {
    if (p.status === 'archived') continue;
    for (const v of p.variants) {
      const lastRestock = db.stockMovements.find((m) => m.variantId === v.id && m.action === 'add');
      const since = lastRestock ? Math.floor((Date.now() - new Date(lastRestock.createdAt).getTime()) / 86_400_000) : Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86_400_000);
      items.push({
        variantId: v.id,
        productId: p.id,
        productName: p.name,
        productType: p.type,
        productImage: p.images.find((i) => i.role === 'main')?.url,
        variantLabel: `${v.color} / ${v.size}`,
        color: v.color,
        colorHex: v.colorHex,
        size: v.size,
        sku: v.sku,
        stock: v.stock,
        reserved: v.reserved,
        available: Math.max(0, v.stock - v.reserved),
        threshold: v.lowStockThreshold,
        status: variantStockStatus(v),
        unitCost: p.costPrice ?? Math.round(p.price * 0.55),
        daysSinceRestock: since,
        updatedAt: p.updatedAt,
      });
    }
  }
  return items;
}

export const inventoryService = {
  /** GET /inventory */
  async getInventory(filters: InventoryFilters = {}): Promise<InventoryItem[]> {
    if (!appConfig.useMocks) return api.get<InventoryItem[]>('/inventory', { ...filters });
    const items = buildItems()
      .filter((i) => matches([i.productName, i.sku, i.variantLabel], filters.search))
      .filter((i) => !filters.status || i.status === filters.status)
      .filter((i) => !filters.productId || i.productId === filters.productId)
      .filter((i) => !filters.productType || i.productType === filters.productType);
    return delay(items);
  },

  /** GET /inventory/low-stock — variants needing attention, most urgent first. */
  async getLowStock(limit = 8): Promise<InventoryItem[]> {
    if (!appConfig.useMocks) return api.get<InventoryItem[]>('/inventory/low-stock', { limit });
    const items = buildItems()
      .filter((i) => i.status !== 'in_stock')
      .sort((a, b) => a.stock - b.stock || a.stock / a.threshold - b.stock / b.threshold)
      .slice(0, limit);
    return delay(items);
  },

  /** POST /inventory/adjustments — returns the updated item and created movement. */
  async adjustStock(input: StockAdjustmentInput): Promise<{ item: InventoryItem; movement: StockMovement }> {
    if (!appConfig.useMocks) return api.post('/inventory/adjustments', input);
    const product = db.products.find((p) => p.variants.some((v) => v.id === input.variantId));
    const variant = product?.variants.find((v) => v.id === input.variantId);
    if (!product || !variant) throw new NotFoundError('Variant');
    if (!Number.isFinite(input.quantity) || input.quantity < 0) throw new ApiError('Quantity must be zero or more.', 400);
    const previous = variant.stock;
    let next = previous;
    if (input.mode === 'add') next = previous + input.quantity;
    if (input.mode === 'remove') {
      if (input.quantity > previous) throw new ApiError(`Cannot remove ${input.quantity} — only ${previous} in stock.`, 400, 'insufficient_stock');
      next = previous - input.quantity;
    }
    if (input.mode === 'set') next = input.quantity;
    variant.stock = next;
    variant.reserved = Math.min(variant.reserved, next);
    product.updatedAt = now();
    const actor = getActor();
    const movement: StockMovement = {
      id: uid('mov'),
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantLabel: `${variant.color} / ${variant.size}`,
      sku: variant.sku,
      action: input.mode,
      quantity: next - previous,
      previousStock: previous,
      newStock: next,
      reason: input.reason,
      notes: input.notes,
      adminId: actor.id,
      adminName: actor.name,
      createdAt: now(),
    };
    db.stockMovements.unshift(movement);
    const delta = next - previous;
    audit('Stock adjusted', 'Inventory', `${variant.sku} (${input.mode === 'set' ? `set ${next}` : delta >= 0 ? `+${delta}` : delta})`, '/inventory/movements');
    const item = buildItems().find((i) => i.variantId === variant.id)!;
    return delay({ item, movement }, 500);
  },

  /** GET /inventory/movements */
  async getMovements(filters: MovementFilters = {}): Promise<StockMovement[]> {
    if (!appConfig.useMocks) return api.get<StockMovement[]>('/inventory/movements', { ...filters });
    const list = db.stockMovements
      .filter((m) => matches([m.productName, m.sku, m.variantLabel, m.notes], filters.search))
      .filter((m) => !filters.action || m.action === filters.action)
      .filter((m) => !filters.adminId || m.adminId === filters.adminId)
      .filter((m) => !filters.productId || m.productId === filters.productId)
      .filter((m) => !filters.variantId || m.variantId === filters.variantId)
      .filter((m) => !filters.from || m.createdAt >= filters.from)
      .filter((m) => !filters.to || m.createdAt <= filters.to)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return delay(list);
  },
};
