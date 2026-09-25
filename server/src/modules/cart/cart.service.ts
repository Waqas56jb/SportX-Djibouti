import type { PoolClient } from 'pg';
import { pool, query, queryOne, withTransaction, type Db } from '../../config/database.js';
import { AppError, notFound } from '../../utils/errors.js';
import { priceCart, type PriceBreakdown, type PriceIssue } from '../pricing/pricing.service.js';
import { getStoreSettings } from '../settings/settings.service.js';

/** cart_items.quantity has a database CHECK of 1..10, whatever the store setting says. */
const DB_MAX_LINE_QUANTITY = 10;

interface CartItemRow {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_price_snapshot: number;
  created_at: Date;
}

interface VariantState {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  brand_name: string;
  color: string;
  size: string;
  sku: string;
  image_url: string | null;
  sellable: boolean;
  available: number;
}

export interface MergeIssue {
  variantId: string;
  type: 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'QUANTITY_REDUCED';
  message: string;
  requested?: number;
  quantity?: number;
}

async function maxPerLine(db: Db): Promise<number> {
  const settings = await getStoreSettings(db);
  return Math.min(settings.maxQuantityPerLine, DB_MAX_LINE_QUANTITY);
}

/** Creates the cart on first use and locks it for the rest of the transaction. */
async function lockCart(tx: PoolClient, userId: string): Promise<{ id: string; coupon_code: string | null }> {
  await query(`insert into public.carts (user_id) values ($1) on conflict (user_id) do nothing`, [userId], tx);
  return (await queryOne<{ id: string; coupon_code: string | null }>(`select id, coupon_code from public.carts where user_id = $1 for update`, [userId], tx))!;
}

async function cartItems(db: Db, userId: string): Promise<{ cart: { id: string; coupon_code: string | null } | null; items: CartItemRow[] }> {
  const cart = await queryOne<{ id: string; coupon_code: string | null }>(`select id, coupon_code from public.carts where user_id = $1`, [userId], db);
  if (!cart) return { cart: null, items: [] };
  const items = await query<CartItemRow>(`select * from public.cart_items where cart_id = $1 order by created_at, id`, [cart.id], db);
  return { cart, items };
}

/** Variant + product + stock facts for display and validation (unpublished/inactive/deleted → not sellable). */
async function variantStates(db: Db, variantIds: string[]): Promise<Map<string, VariantState>> {
  if (!variantIds.length) return new Map();
  const rows = await query<VariantState>(
    `select v.id as variant_id, p.id as product_id, p.name as product_name, p.slug as product_slug, b.name as brand_name,
            v.color, v.size, v.sku,
            (select pi.url from public.product_images pi where pi.product_id = p.id
               order by (pi.color is not null and lower(pi.color) = lower(v.color)) desc, (pi.role = 'MAIN') desc, pi.position limit 1) as image_url,
            (p.status = 'PUBLISHED' and p.deleted_at is null and v.is_active and v.deleted_at is null) as sellable,
            greatest(0, coalesce(i.stock_quantity, 0) - coalesce(i.reserved_quantity, 0))::int as available
       from public.product_variants v
       join public.products p on p.id = v.product_id
       join public.brands b on b.id = p.brand_id
       left join public.inventory i on i.variant_id = v.id
      where v.id = any($1::uuid[])`,
    [variantIds],
    db,
  );
  return new Map(rows.map((r) => [r.variant_id, r]));
}

async function unitPriceOf(db: Db, variantId: string): Promise<number> {
  const b = await priceCart([{ variantId, quantity: 1 }], {}, db);
  return b.lines[0]?.unitPrice ?? 0;
}

function issueForClient(i: PriceIssue, itemId: string | undefined) {
  return { itemId: itemId ?? null, variantId: i.variantId, type: i.type, message: i.message, available: i.available, newUnitPrice: i.newUnitPrice };
}

/** Full, server-priced cart. Lines are identified by cart_items.id. */
function present(cartId: string | null, items: CartItemRow[], breakdown: PriceBreakdown, states: Map<string, VariantState>) {
  const byVariant = new Map(breakdown.lines.map((l) => [l.variantId, l]));
  const issueByVariant = new Map<string, PriceIssue[]>();
  for (const i of breakdown.issues) issueByVariant.set(i.variantId, [...(issueByVariant.get(i.variantId) ?? []), i]);

  return {
    id: cartId,
    currency: breakdown.currency,
    items: items.map((item) => {
      const line = byVariant.get(item.variant_id);
      const state = states.get(item.variant_id);
      const blocking = (issueByVariant.get(item.variant_id) ?? []).find((i) => i.type === 'UNAVAILABLE' || i.type === 'INACTIVE' || i.type === 'OUT_OF_STOCK');
      return {
        id: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        slug: line?.productSlug ?? state?.product_slug ?? null,
        name: line?.productName ?? state?.product_name ?? 'Unavailable item',
        brand: line?.brandName ?? state?.brand_name ?? null,
        image: line?.imageUrl ?? state?.image_url ?? null,
        sku: line?.sku ?? state?.sku ?? null,
        color: line?.color ?? state?.color ?? null,
        colorHex: line?.colorHex ?? null,
        size: line?.size ?? state?.size ?? null,
        quantity: line?.quantity ?? item.quantity,
        unitPrice: line?.unitPrice ?? null,
        originalUnitPrice: line?.originalUnitPrice ?? null,
        compareAtPrice: line?.compareAtPrice ?? null,
        unitDiscount: line?.unitDiscount ?? 0,
        lineTotal: line?.lineTotal ?? 0,
        available: line?.available ?? state?.available ?? 0,
        maxStock: line?.maxQuantity ?? 0,
        appliedDiscount: line?.appliedDiscount ?? null,
        /** OK when purchasable; otherwise the blocking issue type (UNAVAILABLE | INACTIVE | OUT_OF_STOCK). */
        status: blocking ? blocking.type : 'OK',
        addedAt: new Date(item.created_at).toISOString(),
      };
    }),
    issues: breakdown.issues.map((i) => issueForClient(i, items.find((x) => x.variant_id === i.variantId)?.id)),
    coupon: breakdown.coupon,
    totals: breakdown.totals,
  };
}
export type CartView = ReturnType<typeof present>;

export const cartService = {
  /**
   * Prices the cart on the server. Quantities that exceed current stock or the per-line limit are
   * clamped in the stored cart (the issue is still reported) so checkout sees exactly what is shown.
   */
  async get(userId: string, db: Db = pool): Promise<CartView> {
    let { cart, items } = await cartItems(db, userId);
    const breakdown = await priceCart(
      items.map((i) => ({ variantId: i.variant_id, quantity: i.quantity, expectedUnitPrice: i.unit_price_snapshot })),
      { couponCode: cart?.coupon_code ?? null, userId },
      db,
    );
    const clamp = breakdown.lines.filter((l) => {
      const item = items.find((i) => i.variant_id === l.variantId);
      return item && l.quantity > 0 && l.quantity < item.quantity;
    });
    if (clamp.length && cart) {
      for (const l of clamp) await query(`update public.cart_items set quantity = $3 where cart_id = $1 and variant_id = $2`, [cart.id, l.variantId, l.quantity], db);
      items = items.map((i) => {
        const l = clamp.find((c) => c.variantId === i.variant_id);
        return l ? { ...i, quantity: l.quantity } : i;
      });
    }
    // A price change is reported once, then the snapshot follows the current price.
    const changed = breakdown.issues.filter((i) => i.type === 'PRICE_CHANGED' && i.newUnitPrice !== undefined);
    if (changed.length && cart) {
      for (const i of changed) await query(`update public.cart_items set unit_price_snapshot = $3 where cart_id = $1 and variant_id = $2`, [cart.id, i.variantId, i.newUnitPrice], db);
    }
    const priced = new Set(breakdown.lines.map((l) => l.variantId));
    const states = await variantStates(db, items.filter((i) => !priced.has(i.variant_id)).map((i) => i.variant_id));
    return present(cart?.id ?? null, items, breakdown, states);
  },

  /** Adds (or increases) a line. Rejects quantities beyond available stock or the per-line limit. */
  async addItem(userId: string, variantId: string, quantity: number): Promise<CartView> {
    await withTransaction(async (tx) => {
      const cart = await lockCart(tx, userId);
      const state = (await variantStates(tx, [variantId])).get(variantId);
      if (!state || !state.sellable) throw notFound('Product');
      const existing = await queryOne<{ quantity: number }>(`select quantity from public.cart_items where cart_id = $1 and variant_id = $2`, [cart.id, variantId], tx);
      const desired = (existing?.quantity ?? 0) + quantity;
      const max = await maxPerLine(tx);
      if (state.available <= 0) throw new AppError('OUT_OF_STOCK', `${state.product_name} (${state.color} / ${state.size}) is out of stock.`, { available: 0 });
      if (desired > state.available)
        throw new AppError('OUT_OF_STOCK', `Only ${state.available} left of ${state.product_name} (${state.color} / ${state.size}).`, { available: state.available, inCart: existing?.quantity ?? 0 });
      if (desired > max) throw new AppError('VALIDATION_ERROR', `You can buy up to ${max} of this item per order.`, { max, inCart: existing?.quantity ?? 0 });
      const snapshot = await unitPriceOf(tx, variantId);
      await query(
        `insert into public.cart_items (cart_id, product_id, variant_id, quantity, unit_price_snapshot) values ($1, $2, $3, $4, $5)
         on conflict (cart_id, variant_id) do update set quantity = excluded.quantity, unit_price_snapshot = excluded.unit_price_snapshot`,
        [cart.id, state.product_id, variantId, desired, snapshot],
        tx,
      );
      await query(`update public.carts set updated_at = now() where id = $1`, [cart.id], tx);
    });
    return this.get(userId);
  },

  async updateItem(userId: string, itemId: string, quantity: number): Promise<CartView> {
    await withTransaction(async (tx) => {
      const cart = await lockCart(tx, userId);
      const item = await queryOne<CartItemRow>(`select * from public.cart_items where id = $1 and cart_id = $2`, [itemId, cart.id], tx);
      if (!item) throw notFound('Cart item');
      if (quantity === 0) {
        await query(`delete from public.cart_items where id = $1`, [itemId], tx);
        return;
      }
      if (quantity > item.quantity) {
        const state = (await variantStates(tx, [item.variant_id])).get(item.variant_id);
        if (!state || !state.sellable) throw new AppError('ORDER_INVALID', 'This item is no longer available.');
        if (quantity > state.available) throw new AppError('OUT_OF_STOCK', `Only ${state.available} left of ${state.product_name} (${state.color} / ${state.size}).`, { available: state.available });
      }
      const max = await maxPerLine(tx);
      if (quantity > max) throw new AppError('VALIDATION_ERROR', `You can buy up to ${max} of this item per order.`, { max });
      const snapshot = await unitPriceOf(tx, item.variant_id);
      await query(`update public.cart_items set quantity = $2, unit_price_snapshot = case when $3::bigint > 0 then $3::bigint else unit_price_snapshot end where id = $1`, [itemId, quantity, snapshot], tx);
    });
    return this.get(userId);
  },

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const row = await queryOne(`delete from public.cart_items ci using public.carts c where ci.id = $1 and ci.cart_id = c.id and c.user_id = $2 returning ci.id`, [itemId, userId]);
    if (!row) throw notFound('Cart item');
    return this.get(userId);
  },

  async clear(userId: string): Promise<CartView> {
    await query(`delete from public.cart_items ci using public.carts c where ci.cart_id = c.id and c.user_id = $1`, [userId]);
    await query(`update public.carts set coupon_code = null where user_id = $1`, [userId]);
    return this.get(userId);
  },

  /**
   * Merges a guest bag after sign-in. For a variant already in the server cart the larger quantity wins
   * (so re-sending the same bag never doubles it); quantities are clamped to stock and the line limit.
   */
  async merge(userId: string, lines: { variantId: string; quantity: number }[]): Promise<CartView & { mergeIssues: MergeIssue[] }> {
    const incoming = new Map<string, number>();
    for (const l of lines) incoming.set(l.variantId, (incoming.get(l.variantId) ?? 0) + l.quantity);
    const mergeIssues: MergeIssue[] = [];

    await withTransaction(async (tx) => {
      const cart = await lockCart(tx, userId);
      const max = await maxPerLine(tx);
      const states = await variantStates(tx, [...incoming.keys()]);
      const existing = new Map(
        (await query<{ variant_id: string; quantity: number }>(`select variant_id, quantity from public.cart_items where cart_id = $1`, [cart.id], tx)).map((r) => [r.variant_id, r.quantity]),
      );
      for (const [variantId, requested] of incoming) {
        const state = states.get(variantId);
        if (!state || !state.sellable) {
          mergeIssues.push({ variantId, type: 'UNAVAILABLE', message: 'An item in your bag is no longer available and was removed.' });
          continue;
        }
        const label = `${state.product_name} (${state.color} / ${state.size})`;
        if (state.available <= 0) {
          mergeIssues.push({ variantId, type: 'OUT_OF_STOCK', message: `${label} is out of stock.`, requested });
          continue;
        }
        const wanted = Math.max(existing.get(variantId) ?? 0, requested);
        const quantity = Math.min(wanted, state.available, max);
        if (quantity < wanted) mergeIssues.push({ variantId, type: 'QUANTITY_REDUCED', message: `We adjusted ${label} to ${quantity}.`, requested: wanted, quantity });
        if (quantity === existing.get(variantId)) continue;
        const snapshot = await unitPriceOf(tx, variantId);
        await query(
          `insert into public.cart_items (cart_id, product_id, variant_id, quantity, unit_price_snapshot) values ($1, $2, $3, $4, $5)
           on conflict (cart_id, variant_id) do update set quantity = excluded.quantity, unit_price_snapshot = excluded.unit_price_snapshot`,
          [cart.id, state.product_id, variantId, quantity, snapshot],
          tx,
        );
      }
    });
    return { ...(await this.get(userId)), mergeIssues };
  },

  /** Validates the code against the server-priced cart and stores it only when valid. */
  async applyCoupon(userId: string, rawCode: string): Promise<CartView> {
    const code = rawCode.trim().toUpperCase();
    const { items } = await cartItems(pool, userId);
    if (!items.length) throw new AppError('INVALID_COUPON', 'Add items to your bag before applying a code.', { code });
    const b = await priceCart(items.map((i) => ({ variantId: i.variant_id, quantity: i.quantity })), { couponCode: code, userId });
    if (!b.coupon?.valid) throw new AppError('INVALID_COUPON', b.coupon?.message ?? 'This code is not valid.', { code });
    await query(`insert into public.carts (user_id, coupon_code) values ($1, $2) on conflict (user_id) do update set coupon_code = excluded.coupon_code`, [userId, b.coupon.code]);
    return this.get(userId);
  },

  async removeCoupon(userId: string): Promise<CartView> {
    await query(`update public.carts set coupon_code = null where user_id = $1`, [userId]);
    return this.get(userId);
  },

  /** Lines of the user's cart for pricing (coupon validation preview). */
  async lines(userId: string, db: Db = pool) {
    const { cart, items } = await cartItems(db, userId);
    return { couponCode: cart?.coupon_code ?? null, lines: items.map((i) => ({ variantId: i.variant_id, quantity: i.quantity })) };
  },
};
