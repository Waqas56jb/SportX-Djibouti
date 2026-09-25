import type { InventoryItem, InventorySummaryCounts, MovementReason, ProductType, StockAction, StockAdjustmentInput, StockMovement, StockReason, StockStatus } from '@/types';
import { adminApi, type Pagination } from './api';

export interface InventoryFilters {
  search?: string;
  status?: StockStatus | '';
  productId?: string;
  productType?: string;
  page?: number;
  pageSize?: number;
  sort?: 'product_name' | 'sku' | 'stock' | 'available' | 'threshold' | 'updated_at' | 'days_since_restock';
  order?: 'asc' | 'desc';
}

export interface InventoryPage {
  data: InventoryItem[];
  pagination: Pagination;
  summary: InventorySummaryCounts;
}

/** Movement list filters. `direction` = in/out; `reason` = API reason. */
export interface MovementFilters {
  search?: string;
  direction?: 'in' | 'out' | '';
  reason?: MovementReason | '';
  adminId?: string;
  productId?: string;
  variantId?: string;
  /** YYYY-MM-DD (inclusive) */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: 'created_at' | 'change';
  order?: 'asc' | 'desc';
}

interface ApiInventoryItem {
  variantId: string;
  productId: string;
  productName: string;
  productSku: string;
  productType: string;
  productImage: string | null;
  variantLabel: string;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  stock: number;
  reserved: number;
  available: number;
  threshold: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  unitCost: number | null;
  price: number;
  daysSinceRestock: number;
  lastRestockedAt: string | null;
  updatedAt: string;
}

interface ApiMovement {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  variantLabel: string;
  change: number;
  previousStock: number;
  newStock: number;
  reason: MovementReason;
  note: string | null;
  orderId: string | null;
  orderNumber: string | null;
  adminId: string | null;
  adminName: string;
  createdAt: string;
}

const toItem = (i: ApiInventoryItem): InventoryItem => ({
  variantId: i.variantId,
  productId: i.productId,
  productName: i.productName,
  productSku: i.productSku,
  productType: i.productType as ProductType,
  productImage: i.productImage ?? undefined,
  variantLabel: i.variantLabel,
  color: i.color,
  colorHex: i.colorHex,
  size: i.size,
  sku: i.sku,
  stock: i.stock,
  reserved: i.reserved,
  available: i.available,
  threshold: i.threshold,
  status: i.status.toLowerCase() as StockStatus,
  unitCost: i.unitCost ?? 0,
  price: i.price,
  daysSinceRestock: i.daysSinceRestock,
  lastRestockedAt: i.lastRestockedAt ?? undefined,
  updatedAt: i.updatedAt,
});

function actionOf(m: ApiMovement): StockAction {
  if (m.reason === 'ORDER') return 'sale';
  if (m.reason === 'ORDER_CANCELLED' || m.reason === 'REFUND' || m.reason === 'RETURNED') return 'return';
  if (m.change > 0) return 'add';
  if (m.change < 0) return 'remove';
  return 'set';
}

const toMovement = (m: ApiMovement): StockMovement => ({
  id: m.id,
  variantId: m.variantId,
  productId: m.productId,
  productName: m.productName,
  variantLabel: m.variantLabel,
  sku: m.sku,
  action: actionOf(m),
  quantity: m.change,
  previousStock: m.previousStock,
  newStock: m.newStock,
  reason: m.reason,
  notes: m.note ?? undefined,
  orderId: m.orderId ?? undefined,
  orderNumber: m.orderNumber ?? undefined,
  adminId: m.adminId ?? undefined,
  adminName: m.adminName,
  createdAt: m.createdAt,
});

/** UI reasons → API reasons. */
export const API_REASON: Record<StockReason, 'RESTOCK' | 'MANUAL_ADJUSTMENT' | 'DAMAGED' | 'RETURNED' | 'OTHER'> = {
  restock: 'RESTOCK',
  damaged: 'DAMAGED',
  returned: 'RETURNED',
  manual_correction: 'MANUAL_ADJUSTMENT',
  sale_adjustment: 'MANUAL_ADJUSTMENT',
  other: 'OTHER',
};

const listQuery = (f: InventoryFilters) => ({
  page: f.page ?? 1,
  limit: f.pageSize ?? 25,
  search: f.search,
  status: f.status ? f.status.toUpperCase() : undefined,
  productType: f.productType,
  productId: f.productId,
  sort: f.sort,
  order: f.order,
});

export const inventoryService = {
  /** GET /admin/inventory — one page + status counts for the current search/type filters. */
  async listInventory(filters: InventoryFilters = {}, signal?: AbortSignal): Promise<InventoryPage> {
    const res = await adminApi.page<ApiInventoryItem, { summary: InventorySummaryCounts }>('/inventory', listQuery(filters), signal);
    return { data: res.data.map(toItem), pagination: res.pagination, summary: res.summary };
  },

  /** Every variant matching the filters (walks the pages) — for exports/reports only. */
  async getInventory(filters: InventoryFilters = {}): Promise<InventoryItem[]> {
    const out: InventoryItem[] = [];
    for (let page = 1; page <= 100; page++) {
      const res = await inventoryService.listInventory({ ...filters, page, pageSize: 100 });
      out.push(...res.data);
      if (!res.pagination.hasNext) break;
    }
    return out;
  },

  /** GET /admin/inventory/:variantId */
  async getItem(variantId: string): Promise<InventoryItem> {
    return toItem(await adminApi.get<ApiInventoryItem>(`/inventory/${variantId}`));
  },

  /** GET /admin/inventory/low-stock — low (not out) variants, most urgent first. */
  async getLowStock(limit = 8): Promise<InventoryItem[]> {
    const res = await adminApi.page<ApiInventoryItem>('/inventory/low-stock', { limit, page: 1 });
    return res.data.map(toItem);
  },

  /** GET /admin/inventory/out-of-stock */
  async getOutOfStock(limit = 8): Promise<InventoryItem[]> {
    const res = await adminApi.page<ApiInventoryItem>('/inventory/out-of-stock', { limit, page: 1 });
    return res.data.map(toItem);
  },

  /** POST /admin/inventory/:variantId/adjust { mode, quantity, reason, note } → updated item + movement. */
  async adjustStock(input: StockAdjustmentInput): Promise<{ item: InventoryItem; movement: StockMovement | null }> {
    const res = await adminApi.post<{ item: ApiInventoryItem; movement: ApiMovement | null }>(`/inventory/${input.variantId}/adjust`, {
      mode: input.mode,
      quantity: input.quantity,
      reason: API_REASON[input.reason],
      note: input.notes?.trim() || null,
    });
    return { item: toItem(res.item), movement: res.movement ? toMovement(res.movement) : null };
  },

  /** PATCH /admin/inventory/:variantId { lowStockThreshold } */
  async setThreshold(variantId: string, lowStockThreshold: number): Promise<InventoryItem> {
    const res = await adminApi.patch<{ item: ApiInventoryItem }>(`/inventory/${variantId}`, { lowStockThreshold });
    return toItem(res.item);
  },

  /** GET /admin/inventory/movements — server-paginated audit trail. */
  async listMovements(filters: MovementFilters = {}, signal?: AbortSignal): Promise<{ data: StockMovement[]; pagination: Pagination }> {
    const res = await adminApi.page<ApiMovement>(
      '/inventory/movements',
      {
        page: filters.page ?? 1,
        limit: filters.pageSize ?? 25,
        search: filters.search,
        direction: filters.direction || undefined,
        reason: filters.reason || undefined,
        adminId: filters.adminId,
        productId: filters.productId,
        variantId: filters.variantId,
        date_from: filters.from,
        date_to: filters.to,
        sort: filters.sort,
        order: filters.order ?? 'desc',
      },
      signal,
    );
    return { data: res.data.map(toMovement), pagination: res.pagination };
  },

  /** All movements matching the filters (walks the pages) — for CSV export. */
  async getMovements(filters: MovementFilters = {}): Promise<StockMovement[]> {
    const out: StockMovement[] = [];
    for (let page = 1; page <= 100; page++) {
      const res = await inventoryService.listMovements({ ...filters, page, pageSize: 100 });
      out.push(...res.data);
      if (!res.pagination.hasNext) break;
    }
    return out;
  },
};
