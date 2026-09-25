import { z } from 'zod';
import type { Request } from 'express';
import { query, queryOne, withTransaction, type Db, pool } from '../../config/database.js';
import { notFound } from '../../utils/errors.js';
import { adminListQuery, dateBounds, offsetOf } from '../../utils/pagination.js';
import { audit } from '../../services/audit.service.js';
import { iso, upperEnum } from '../reports/zod-helpers.js';
import { adjustStock } from './inventory.core.js';

/**
 * Admin inventory views. Stock status is based on availability (stock - reserved):
 *   OUT_OF_STOCK ≤ 0 < LOW_STOCK ≤ threshold < IN_STOCK.
 * Every stock change goes through inventory.core.adjustStock (movement + low-stock alert).
 */
export const STOCK_STATUSES = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] as const;
const AVAILABLE = `(i.stock_quantity - i.reserved_quantity)`;
const STATUS_SQL = `case when ${AVAILABLE} <= 0 then 'OUT_OF_STOCK' when ${AVAILABLE} <= i.low_stock_threshold then 'LOW_STOCK' else 'IN_STOCK' end`;

const SELECT = `select i.variant_id, v.product_id, p.name as product_name, p.sku as product_sku, p.product_type, p.status as product_status,
    v.sku, v.color, v.color_hex, v.size, v.is_active, i.stock_quantity, i.reserved_quantity, i.low_stock_threshold,
    greatest(${AVAILABLE}, 0) as available, ${STATUS_SQL} as stock_status, p.cost_price, coalesce(v.price, p.price) as price,
    i.last_restocked_at, i.updated_at,
    extract(day from now() - coalesce(i.last_restocked_at, v.created_at))::int as days_since_restock,
    (select im.url from public.product_images im where im.product_id = p.id order by (im.role = 'MAIN') desc, im.position limit 1) as image
  from public.inventory i
  join public.product_variants v on v.id = i.variant_id and v.deleted_at is null
  join public.products p on p.id = v.product_id and p.deleted_at is null`;

interface Row {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  product_type: string;
  product_status: string;
  sku: string;
  color: string;
  color_hex: string;
  size: string;
  is_active: boolean;
  stock_quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  available: number;
  stock_status: (typeof STOCK_STATUSES)[number];
  cost_price: number | null;
  price: number;
  last_restocked_at: Date | null;
  updated_at: Date;
  days_since_restock: number;
  image: string | null;
}

export function toInventoryItem(r: Row) {
  return {
    variantId: r.variant_id,
    productId: r.product_id,
    productName: r.product_name,
    productSku: r.product_sku,
    productType: r.product_type,
    productStatus: r.product_status,
    image: r.image,
    productImage: r.image,
    variantLabel: `${r.color} / ${r.size}`,
    sku: r.sku,
    color: r.color,
    colorHex: r.color_hex,
    size: r.size,
    active: r.is_active,
    stock: r.stock_quantity,
    reserved: r.reserved_quantity,
    available: r.available,
    threshold: r.low_stock_threshold,
    status: r.stock_status,
    unitCost: r.cost_price,
    price: r.price,
    daysSinceRestock: r.days_since_restock,
    lastRestockedAt: iso(r.last_restocked_at),
    updatedAt: iso(r.updated_at)!,
  };
}
export type InventoryItem = ReturnType<typeof toInventoryItem>;

export const inventoryListQuery = adminListQuery(['product_name', 'sku', 'stock', 'available', 'threshold', 'updated_at', 'days_since_restock']).extend({
  status: upperEnum([...STOCK_STATUSES]).optional(),
  productType: z.string().trim().max(40).optional(),
  product_type: z.string().trim().max(40).optional(),
  product: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  includeArchived: z.enum(['true', 'false']).optional(),
});
export type InventoryListQuery = z.infer<typeof inventoryListQuery>;

const SORT: Record<string, string> = {
  product_name: 'lower(p.name)',
  sku: 'v.sku',
  stock: 'i.stock_quantity',
  available: AVAILABLE,
  threshold: 'i.low_stock_threshold',
  updated_at: 'i.updated_at',
  days_since_restock: 'coalesce(i.last_restocked_at, v.created_at)',
};

export async function listInventory(f: InventoryListQuery) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (f.includeArchived !== 'true') where.push(`p.status <> 'ARCHIVED'`);
  if (f.search) add(`(p.name ilike ? or v.sku ilike ? or p.sku ilike ? or (v.color || ' / ' || v.size) ilike ?)`, `%${f.search}%`);
  const productType = f.productType ?? f.product_type;
  if (productType) add('p.product_type = ?', productType);
  const product = f.product ?? f.productId;
  if (product) add('p.id = ?', product);
  const { from, to } = dateBounds(f.date_from, f.date_to);
  if (from) add('i.updated_at >= ?', from);
  if (to) add('i.updated_at <= ?', to);

  // Summary ignores the status filter so the UI tabs can show every count.
  const baseWhere = where.length ? where.join(' and ') : 'true';
  const summary = await queryOne<Record<string, number>>(
    `select count(*)::int as total, count(*) filter (where ${STATUS_SQL} = 'IN_STOCK')::int as in_stock,
            count(*) filter (where ${STATUS_SQL} = 'LOW_STOCK')::int as low_stock,
            count(*) filter (where ${STATUS_SQL} = 'OUT_OF_STOCK')::int as out_of_stock,
            coalesce(sum(i.stock_quantity), 0)::int as units, coalesce(sum(i.reserved_quantity), 0)::int as reserved
       from public.inventory i
       join public.product_variants v on v.id = i.variant_id and v.deleted_at is null
       join public.products p on p.id = v.product_id and p.deleted_at is null
      where ${baseWhere}`,
    params,
  );

  if (f.status) add(`${STATUS_SQL} = ?`, f.status);
  const w = where.length ? where.join(' and ') : 'true';
  const n = params.length;
  const defaultSort = f.status && f.status !== 'IN_STOCK' ? `${AVAILABLE} asc` : 'lower(p.name) asc';
  const order = f.sort ? `${SORT[f.sort]} ${f.order}` : defaultSort;
  const rows = await query<Row & { total: number }>(
    `${SELECT.replace('select ', 'select count(*) over ()::int as total, ')} where ${w} order by ${order}, v.position, v.id limit $${n + 1} offset $${n + 2}`,
    [...params, f.limit, offsetOf(f.page, f.limit)],
  );
  const total = rows[0]?.total ?? (await queryOne<{ n: number }>(`select count(*)::int as n from public.inventory i join public.product_variants v on v.id = i.variant_id and v.deleted_at is null join public.products p on p.id = v.product_id and p.deleted_at is null where ${w}`, params))!.n;
  const s = summary!;
  return {
    rows: rows.map(toInventoryItem),
    total,
    summary: { total: s.total, inStock: s.in_stock, lowStock: s.low_stock, outOfStock: s.out_of_stock, units: s.units, reserved: s.reserved },
  };
}

export async function getInventoryItem(variantId: string, db: Db = pool) {
  const r = await queryOne<Row>(`${SELECT} where i.variant_id = $1`, [variantId], db);
  if (!r) throw notFound('Variant');
  return toInventoryItem(r);
}

// ─── Adjustments ────────────────────────────────────────────────────────────

export const ADJUST_REASONS = ['RESTOCK', 'MANUAL_ADJUSTMENT', 'DAMAGED', 'RETURNED', 'OTHER'] as const;
/** Admin UI spellings → canonical reasons. */
const REASON_ALIASES: Record<string, (typeof ADJUST_REASONS)[number]> = { MANUAL_CORRECTION: 'MANUAL_ADJUSTMENT', SALE_ADJUSTMENT: 'MANUAL_ADJUSTMENT' };
const reasonSchema = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const up = v.trim().toUpperCase();
  return REASON_ALIASES[up] ?? up;
}, z.enum(ADJUST_REASONS));
const noteSchema = z.string().trim().max(500).optional().nullable();

export const adjustBody = z
  .object({
    mode: z.enum(['add', 'remove', 'set']),
    quantity: z.number().int().min(0).max(1_000_000),
    reason: reasonSchema,
    note: noteSchema,
    notes: noteSchema,
  })
  .transform(({ notes, ...b }) => ({ ...b, note: b.note ?? notes ?? null }))
  .refine((b) => b.mode === 'set' || b.quantity > 0, { message: 'Quantity must be at least 1.', path: ['quantity'] })
  .refine((b) => b.reason !== 'OTHER' || (b.note && b.note.length >= 3), { message: 'A note is required when the reason is "Other".', path: ['note'] });
export type AdjustBody = z.infer<typeof adjustBody>;

export const patchBody = z
  .object({
    stockQuantity: z.number().int().min(0).max(1_000_000).optional(),
    lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
    reason: reasonSchema.optional(),
    note: noteSchema,
  })
  .refine((b) => b.stockQuantity !== undefined || b.lowStockThreshold !== undefined, { message: 'Provide stockQuantity and/or lowStockThreshold.' })
  .refine((b) => b.reason !== 'OTHER' || (b.note && b.note.length >= 3), { message: 'A note is required when the reason is "Other".', path: ['note'] });
export type PatchBody = z.infer<typeof patchBody>;

async function movementById(id: string, db: Db) {
  const [row] = await listMovementsRaw(`m.id = $1`, [id], 1, 0, db);
  if (!row) return null;
  const { _total, ...movement } = row;
  return movement;
}

export async function adjustVariant(
  req: Request,
  variantId: string,
  input: { mode: 'add' | 'remove' | 'set'; quantity: number; reason: (typeof ADJUST_REASONS)[number]; note: string | null; lowStockThreshold?: number },
) {
  return withTransaction(async (tx) => {
    const result = await adjustStock(tx, {
      variantId,
      mode: input.mode,
      quantity: input.quantity,
      reason: input.reason,
      note: input.note,
      adminId: req.auth!.userId,
      lowStockThreshold: input.lowStockThreshold,
    });
    const item = await getInventoryItem(variantId, tx);
    await audit(
      req,
      {
        action: 'Stock adjusted',
        entityType: 'inventory',
        entityId: variantId,
        metadata: {
          sku: item.sku,
          product: item.productName,
          mode: input.mode,
          quantity: input.quantity,
          previous: result.previous,
          next: result.next,
          change: result.next - result.previous,
          reason: input.reason,
          note: input.note,
          ...(input.lowStockThreshold !== undefined ? { lowStockThreshold: input.lowStockThreshold } : {}),
        },
      },
      tx,
    );
    const movement = result.movement ? await movementById(result.movement.id, tx) : null;
    return { item, movement };
  });
}

/** PATCH semantics: set the exact stock and/or the low-stock threshold. */
export async function patchVariant(req: Request, variantId: string, b: PatchBody) {
  if (b.stockQuantity === undefined) {
    // Threshold only: a zero "add" keeps stock untouched (no movement) and updates the threshold.
    return withTransaction(async (tx) => {
      const before = await getInventoryItem(variantId, tx);
      await adjustStock(tx, { variantId, mode: 'add', quantity: 0, reason: 'MANUAL_ADJUSTMENT', adminId: req.auth!.userId, lowStockThreshold: b.lowStockThreshold });
      const item = await getInventoryItem(variantId, tx);
      await audit(req, { action: 'Low-stock threshold changed', entityType: 'inventory', entityId: variantId, metadata: { sku: item.sku, from: before.threshold, to: item.threshold } }, tx);
      return { item, movement: null };
    });
  }
  return adjustVariant(req, variantId, { mode: 'set', quantity: b.stockQuantity, reason: b.reason ?? 'MANUAL_ADJUSTMENT', note: b.note ?? null, lowStockThreshold: b.lowStockThreshold });
}

// ─── Movements ──────────────────────────────────────────────────────────────

const INVENTORY_REASONS = ['RESTOCK', 'MANUAL_ADJUSTMENT', 'DAMAGED', 'RETURNED', 'ORDER', 'ORDER_CANCELLED', 'REFUND', 'OTHER'] as const;

export const movementsQuery = adminListQuery(['created_at', 'change']).extend({
  variant: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  product: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  reason: upperEnum([...INVENTORY_REASONS]).optional(),
  admin: z.string().uuid().optional(),
  adminId: z.string().uuid().optional(),
  direction: z.enum(['in', 'out']).optional(),
});
export type MovementsQuery = z.infer<typeof movementsQuery>;

interface MovementRow {
  id: string;
  variant_id: string;
  product_id: string;
  change: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  note: string | null;
  order_id: string | null;
  order_number: string | null;
  admin_id: string | null;
  admin_name: string | null;
  product_name: string;
  sku: string;
  color: string;
  size: string;
  created_at: Date;
  total: number;
}

async function listMovementsRaw(where: string, params: unknown[], limit: number, offset: number, db: Db = pool, order = 'm.created_at desc') {
  const n = params.length;
  const rows = await query<MovementRow>(
    `select m.id, m.variant_id, m.product_id, m.change, m.previous_stock, m.new_stock, m.reason, m.note, m.order_id, o.order_number,
            m.admin_id, nullif(trim(a.first_name || ' ' || a.last_name), '') as admin_name,
            p.name as product_name, v.sku, v.color, v.size, m.created_at, count(*) over ()::int as total
       from public.inventory_movements m
       join public.product_variants v on v.id = m.variant_id
       join public.products p on p.id = m.product_id
       left join public.users a on a.id = m.admin_id
       left join public.orders o on o.id = m.order_id
      where ${where} order by ${order}, m.id limit $${n + 1} offset $${n + 2}`,
    [...params, limit, offset],
    db,
  );
  return rows.map((r) => ({
    id: r.id,
    variantId: r.variant_id,
    productId: r.product_id,
    productName: r.product_name,
    sku: r.sku,
    variantLabel: `${r.color} / ${r.size}`,
    change: r.change,
    quantity: r.change,
    direction: r.change >= 0 ? 'in' : 'out',
    previousStock: r.previous_stock,
    newStock: r.new_stock,
    reason: r.reason,
    note: r.note,
    orderId: r.order_id,
    orderNumber: r.order_number,
    adminId: r.admin_id,
    adminName: r.admin_name ?? (r.admin_id ? 'Staff' : 'System'),
    createdAt: iso(r.created_at)!,
    _total: r.total,
  }));
}

export async function listMovements(f: MovementsQuery) {
  const where: string[] = ['true'];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  const variant = f.variant ?? f.variantId;
  const product = f.product ?? f.productId;
  const admin = f.admin ?? f.adminId;
  if (variant) add('m.variant_id = ?', variant);
  if (product) add('m.product_id = ?', product);
  if (admin) add('m.admin_id = ?', admin);
  if (f.reason) add('m.reason = ?::public.inventory_reason', f.reason);
  if (f.direction === 'in') where.push('m.change > 0');
  if (f.direction === 'out') where.push('m.change < 0');
  if (f.search) add(`(p.name ilike ? or v.sku ilike ? or coalesce(m.note, '') ilike ? or coalesce(o.order_number, '') ilike ?)`, `%${f.search}%`);
  const { from, to } = dateBounds(f.date_from, f.date_to);
  if (from) add('m.created_at >= ?', from);
  if (to) add('m.created_at <= ?', to);
  const order = f.sort === 'change' ? `m.change ${f.order}` : `m.created_at ${f.order}`;
  const rows = await listMovementsRaw(where.join(' and '), params, f.limit, offsetOf(f.page, f.limit), pool, order);
  let total = rows[0]?._total;
  if (total === undefined) {
    total = (await queryOne<{ n: number }>(
      `select count(*)::int as n from public.inventory_movements m join public.product_variants v on v.id = m.variant_id join public.products p on p.id = m.product_id
         left join public.orders o on o.id = m.order_id where ${where.join(' and ')}`,
      params,
    ))!.n;
  }
  return { rows: rows.map(({ _total, ...r }) => r), total };
}
