import type { PoolClient } from 'pg';
import { query, queryOne } from '../../config/database.js';
import { AppError, notFound } from '../../utils/errors.js';
import { notificationService } from '../../services/notification/notification.service.js';
import type { InventoryReason } from '../../types/common.js';

/**
 * Inventory rules (all operations take the transaction client):
 *   available = stock_quantity - reserved_quantity, never negative (enforced by CHECK constraints too).
 *   Order placed      → reserve   (reserved += q)                      order.inventory_state = RESERVED
 *   Paid / shipped    → commit    (stock -= q, reserved -= q, movement ORDER)            → COMMITTED
 *   Cancel before commit → release (reserved -= q)                                       → RELEASED
 *   Cancel/refund after commit → restock (stock += q, movement ORDER_CANCELLED | REFUND)
 */

export interface StockLine {
  variantId: string;
  productId: string;
  quantity: number;
}

interface InvRow {
  variant_id: string;
  stock_quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
}

/** Atomically reserves stock. Throws OUT_OF_STOCK (nothing reserved) if any line cannot be satisfied. */
export async function reserveStock(tx: PoolClient, lines: StockLine[]): Promise<void> {
  // Deterministic lock order prevents deadlocks between concurrent checkouts.
  for (const line of [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
    const row = await queryOne<InvRow>(
      `update public.inventory set reserved_quantity = reserved_quantity + $2
        where variant_id = $1 and stock_quantity - reserved_quantity >= $2
        returning variant_id, stock_quantity, reserved_quantity, low_stock_threshold`,
      [line.variantId, line.quantity],
      tx,
    );
    if (!row) {
      const cur = await queryOne<{ available: number; label: string }>(
        `select greatest(i.stock_quantity - i.reserved_quantity, 0) as available, p.name || ' (' || v.color || ' / ' || v.size || ')' as label
           from public.inventory i join public.product_variants v on v.id = i.variant_id join public.products p on p.id = v.product_id
          where i.variant_id = $1`,
        [line.variantId],
        tx,
      );
      throw new AppError('OUT_OF_STOCK', cur ? `Only ${cur.available} left of ${cur.label}.` : 'This item is no longer available.', {
        variantId: line.variantId,
        available: cur?.available ?? 0,
      });
    }
    await maybeNotifyLowStock(tx, row, row.stock_quantity - row.reserved_quantity + line.quantity);
  }
}

async function orderLines(tx: PoolClient, orderId: string): Promise<StockLine[]> {
  return query<StockLine>(
    `select variant_id as "variantId", product_id as "productId", quantity from public.order_items
      where order_id = $1 and variant_id is not null order by variant_id`,
    [orderId],
    tx,
  );
}

async function lockOrderState(tx: PoolClient, orderId: string) {
  const o = await queryOne<{ inventory_state: 'RESERVED' | 'COMMITTED' | 'RELEASED' }>(`select inventory_state from public.orders where id = $1 for update`, [orderId], tx);
  if (!o) throw notFound('Order');
  return o.inventory_state;
}

/** Converts a reservation into a real stock decrement (payment confirmed, or COD order shipped). Idempotent. */
export async function commitOrderStock(tx: PoolClient, orderId: string): Promise<void> {
  if ((await lockOrderState(tx, orderId)) !== 'RESERVED') return;
  for (const l of await orderLines(tx, orderId)) {
    const row = await queryOne<InvRow & { prev: number }>(
      `update public.inventory set stock_quantity = stock_quantity - $2, reserved_quantity = greatest(reserved_quantity - $2, 0)
        where variant_id = $1 returning variant_id, stock_quantity, reserved_quantity, low_stock_threshold, stock_quantity + $2 as prev`,
      [l.variantId, l.quantity],
      tx,
    );
    if (!row) continue;
    await recordMovement(tx, { variantId: l.variantId, productId: l.productId, previous: row.prev, next: row.stock_quantity, reason: 'ORDER', orderId });
    await query(`update public.products set units_sold = units_sold + $2 where id = $1`, [l.productId, l.quantity], tx);
  }
  await query(`update public.orders set inventory_state = 'COMMITTED' where id = $1`, [orderId], tx);
}

/** Releases an uncommitted reservation (cancelled / expired unpaid order). Idempotent. */
export async function releaseOrderStock(tx: PoolClient, orderId: string): Promise<void> {
  if ((await lockOrderState(tx, orderId)) !== 'RESERVED') return;
  for (const l of await orderLines(tx, orderId)) {
    await query(`update public.inventory set reserved_quantity = greatest(reserved_quantity - $2, 0) where variant_id = $1`, [l.variantId, l.quantity], tx);
  }
  await query(`update public.orders set inventory_state = 'RELEASED' where id = $1`, [orderId], tx);
}

/** Puts committed stock back (cancellation after payment, or refund with restock). */
export async function restockOrder(tx: PoolClient, orderId: string, reason: 'ORDER_CANCELLED' | 'REFUND', adminId?: string | null): Promise<void> {
  const state = await lockOrderState(tx, orderId);
  if (state === 'RESERVED') return releaseOrderStock(tx, orderId);
  if (state !== 'COMMITTED') return;
  for (const l of await orderLines(tx, orderId)) {
    const row = await queryOne<{ stock_quantity: number }>(
      `update public.inventory set stock_quantity = stock_quantity + $2 where variant_id = $1 returning stock_quantity`,
      [l.variantId, l.quantity],
      tx,
    );
    if (!row) continue;
    await recordMovement(tx, { variantId: l.variantId, productId: l.productId, previous: row.stock_quantity - l.quantity, next: row.stock_quantity, reason, orderId, adminId });
    await query(`update public.products set units_sold = greatest(units_sold - $2, 0) where id = $1`, [l.productId, l.quantity], tx);
  }
  await query(`update public.orders set inventory_state = 'RELEASED' where id = $1`, [orderId], tx);
}

export interface AdjustInput {
  variantId: string;
  mode: 'add' | 'remove' | 'set';
  quantity: number;
  reason: InventoryReason;
  note?: string | null;
  adminId: string | null;
  lowStockThreshold?: number;
}

/** Manual stock change from the admin. Cannot drop below what is already reserved for open orders. */
export async function adjustStock(tx: PoolClient, input: AdjustInput) {
  const cur = await queryOne<InvRow & { product_id: string }>(
    `select i.variant_id, i.stock_quantity, i.reserved_quantity, i.low_stock_threshold, v.product_id
       from public.inventory i join public.product_variants v on v.id = i.variant_id
      where i.variant_id = $1 and v.deleted_at is null for update of i`,
    [input.variantId],
    tx,
  );
  if (!cur) throw notFound('Variant');
  if (!Number.isInteger(input.quantity) || input.quantity < 0) throw new AppError('VALIDATION_ERROR', 'Quantity must be a whole number of zero or more.');
  const previous = cur.stock_quantity;
  const next = input.mode === 'add' ? previous + input.quantity : input.mode === 'remove' ? previous - input.quantity : input.quantity;
  if (next < 0) throw new AppError('VALIDATION_ERROR', `Cannot remove ${input.quantity} — only ${previous} in stock.`);
  if (next < cur.reserved_quantity) throw new AppError('CONFLICT', `${cur.reserved_quantity} unit(s) are reserved for open orders; stock cannot go below that.`);
  const threshold = input.lowStockThreshold ?? cur.low_stock_threshold;
  const updated = await queryOne<InvRow>(
    `update public.inventory set stock_quantity = $2, low_stock_threshold = $3,
            last_restocked_at = case when $2 > stock_quantity then now() else last_restocked_at end
      where variant_id = $1 returning variant_id, stock_quantity, reserved_quantity, low_stock_threshold`,
    [input.variantId, next, threshold],
    tx,
  );
  const movement = next !== previous
    ? await recordMovement(tx, { variantId: input.variantId, productId: cur.product_id, previous, next, reason: input.reason, note: input.note, adminId: input.adminId })
    : null;
  await maybeNotifyLowStock(tx, updated!, previous - cur.reserved_quantity);
  return { inventory: updated!, movement, previous, next };
}

async function recordMovement(
  tx: PoolClient,
  m: { variantId: string; productId: string; previous: number; next: number; reason: InventoryReason; note?: string | null; orderId?: string; adminId?: string | null },
) {
  return queryOne<{ id: string }>(
    `insert into public.inventory_movements (variant_id, product_id, change, previous_stock, new_stock, reason, note, order_id, admin_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [m.variantId, m.productId, m.next - m.previous, m.previous, m.next, m.reason, m.note ?? null, m.orderId ?? null, m.adminId ?? null],
    tx,
  );
}

/** Staff alert when a variant crosses its low-stock threshold (only on the crossing, not every change). */
async function maybeNotifyLowStock(tx: PoolClient, row: InvRow, previousAvailable: number) {
  const available = row.stock_quantity - row.reserved_quantity;
  if (available > row.low_stock_threshold || previousAvailable <= row.low_stock_threshold) return;
  const info = await queryOne<{ name: string; color: string; size: string; sku: string }>(
    `select p.name, v.color, v.size, v.sku from public.product_variants v join public.products p on p.id = v.product_id where v.id = $1`,
    [row.variant_id],
    tx,
  );
  if (!info) return;
  await notificationService.toStaff(
    {
      type: 'LOW_STOCK',
      title: available <= 0 ? `Out of stock: ${info.name}` : `Low stock: ${info.name}`,
      message: `${info.color} / ${info.size} (${info.sku}) has ${Math.max(available, 0)} available.`,
      link: `/inventory?status=${available <= 0 ? 'out_of_stock' : 'low_stock'}`,
      data: { variantId: row.variant_id, available },
    },
    tx,
  );
}
