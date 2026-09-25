import { pool, query, type Db } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { discountAmount, taxOf } from '../../utils/price.js';
import { getStoreSettings } from '../settings/settings.service.js';
import { shippingService } from '../shipping/shipping.service.js';
import { evaluateCoupon } from '../coupons/coupon.validation.js';
import type { ShippingQuote } from '../../services/shipping/shipping.provider.js';
import type { DiscountType } from '../../types/common.js';

export interface PriceLineInput {
  variantId: string;
  quantity: number;
  /** Price the client last saw (optional) — only used to report PRICE_CHANGED, never to charge. */
  expectedUnitPrice?: number;
}

export type PriceIssueType = 'UNAVAILABLE' | 'INACTIVE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'QUANTITY_LIMIT' | 'PRICE_CHANGED';

export interface PriceIssue {
  variantId: string;
  type: PriceIssueType;
  message: string;
  available?: number;
  newUnitPrice?: number;
}

export interface PricedLine {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  brandName: string;
  categoryId: string;
  parentCategoryId: string | null;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  imageUrl: string | null;
  quantity: number;
  originalUnitPrice: number;
  compareAtPrice: number | null;
  unitPrice: number;
  unitDiscount: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTotal: number;
  available: number;
  maxQuantity: number;
  appliedDiscount: { source: 'DISCOUNT' | 'FLASH_SALE'; id: string; name: string } | null;
}

export interface PriceBreakdown {
  currency: string;
  lines: PricedLine[];
  issues: PriceIssue[];
  coupon: { code: string; valid: boolean; message: string; discount: number; type?: DiscountType; value?: number; description?: string } | null;
  shipping: ShippingQuote | null;
  totals: {
    itemCount: number;
    subtotal: number;
    productDiscount: number;
    merchandiseTotal: number;
    couponDiscount: number;
    shipping: number;
    tax: number;
    taxInclusive: boolean;
    grandTotal: number;
    savings: number;
    freeShippingThreshold: number | null;
    freeShippingRemaining: number;
  };
}

interface VariantRow {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  brand_id: string;
  brand_name: string;
  category_id: string;
  parent_category_id: string | null;
  sku: string;
  color: string;
  color_hex: string;
  size: string;
  product_price: number;
  product_compare_at: number | null;
  variant_price: number | null;
  variant_compare_at: number | null;
  product_status: string;
  product_deleted: boolean;
  variant_active: boolean;
  variant_deleted: boolean;
  stock: number | null;
  reserved: number | null;
  image_url: string | null;
}

interface PromoRow {
  source: 'DISCOUNT' | 'FLASH_SALE';
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  applies_to: 'ALL' | 'PRODUCTS' | 'CATEGORIES' | 'BRANDS';
  target_ids: string[];
}

/** Loads variant + product + inventory + main image for many variants in one query (no N+1). */
async function loadVariants(db: Db, ids: string[], lock: boolean): Promise<Map<string, VariantRow>> {
  if (!ids.length) return new Map();
  const rows = await query<VariantRow>(
    `select v.id as variant_id, p.id as product_id, p.name as product_name, p.slug as product_slug,
            b.id as brand_id, b.name as brand_name, p.category_id, c.parent_id as parent_category_id,
            v.sku, v.color, v.color_hex, v.size,
            p.price as product_price, p.compare_at_price as product_compare_at,
            v.price as variant_price, v.compare_at_price as variant_compare_at,
            p.status as product_status, (p.deleted_at is not null) as product_deleted,
            v.is_active as variant_active, (v.deleted_at is not null) as variant_deleted,
            i.stock_quantity as stock, i.reserved_quantity as reserved,
            (select pi.url from public.product_images pi where pi.product_id = p.id
               order by (pi.color is not null and lower(pi.color) = lower(v.color)) desc, (pi.role = 'MAIN') desc, pi.position limit 1) as image_url
       from public.product_variants v
       join public.products p on p.id = v.product_id
       join public.brands b on b.id = p.brand_id
       join public.categories c on c.id = p.category_id
       join public.inventory i on i.variant_id = v.id
      where v.id = any($1::uuid[])
      ${lock ? 'for update of i' : ''}`,
    [ids],
    db,
  );
  return new Map(rows.map((r) => [r.variant_id, r]));
}

/** Automatic discounts and flash sales active right now. */
export async function activePromotions(db: Db = pool): Promise<PromoRow[]> {
  return query<PromoRow>(
    `select 'DISCOUNT' as source, id, name, type, value, applies_to, target_ids from public.discounts
      where is_active and starts_at <= now() and (ends_at is null or ends_at > now())
     union all
     select 'FLASH_SALE', id, name, 'PERCENTAGE'::public.discount_type, discount_percent, 'PRODUCTS'::public.discount_scope, product_ids from public.flash_sales
      where is_active and starts_at <= now() and ends_at > now()`,
    [],
    db,
  );
}

/** Best single promotion for a unit (promotions do not stack). */
export function bestPromotion(
  promos: PromoRow[],
  item: { productId: string; categoryId: string; parentCategoryId: string | null; brandId: string; unitPrice: number },
): { amount: number; promo: PromoRow } | null {
  let best: { amount: number; promo: PromoRow } | null = null;
  for (const p of promos) {
    const applies =
      p.applies_to === 'ALL' ||
      (p.applies_to === 'PRODUCTS' && p.target_ids.includes(item.productId)) ||
      (p.applies_to === 'BRANDS' && p.target_ids.includes(item.brandId)) ||
      (p.applies_to === 'CATEGORIES' && (p.target_ids.includes(item.categoryId) || (item.parentCategoryId !== null && p.target_ids.includes(item.parentCategoryId))));
    if (!applies) continue;
    const amount = discountAmount(item.unitPrice, p.type, p.value);
    if (amount > 0 && (!best || amount > best.amount)) best = { amount, promo: p };
  }
  return best;
}

export interface PriceOptions {
  couponCode?: string | null;
  shippingMethod?: string | null;
  userId?: string | null;
  city?: string;
  /** Lock inventory + coupon rows (inside the order transaction). */
  lock?: boolean;
}

/**
 * The single source of truth for money. Carts, checkout validation and order creation all call this;
 * controllers never compute totals themselves. Client-supplied prices are ignored.
 */
export async function priceCart(lines: PriceLineInput[], opts: PriceOptions = {}, db: Db = pool): Promise<PriceBreakdown> {
  const settings = await getStoreSettings(db);
  const merged = new Map<string, PriceLineInput>();
  for (const l of lines) {
    const prev = merged.get(l.variantId);
    merged.set(l.variantId, prev ? { ...prev, quantity: prev.quantity + l.quantity } : { ...l });
  }
  const variants = await loadVariants(db, [...merged.keys()], Boolean(opts.lock));
  const promos = await activePromotions(db);

  const priced: PricedLine[] = [];
  const issues: PriceIssue[] = [];

  for (const input of merged.values()) {
    const v = variants.get(input.variantId);
    if (!v || v.product_deleted || v.variant_deleted) {
      issues.push({ variantId: input.variantId, type: 'UNAVAILABLE', message: 'This item is no longer available.' });
      continue;
    }
    if (v.product_status !== 'PUBLISHED' || !v.variant_active) {
      issues.push({ variantId: input.variantId, type: 'INACTIVE', message: `${v.product_name} (${v.color} / ${v.size}) is not available for purchase.` });
      continue;
    }
    const available = Math.max(0, (v.stock ?? 0) - (v.reserved ?? 0));
    const maxQuantity = Math.min(available, settings.maxQuantityPerLine);
    if (available <= 0) {
      issues.push({ variantId: input.variantId, type: 'OUT_OF_STOCK', message: `${v.product_name} (${v.color} / ${v.size}) is out of stock.`, available: 0 });
      continue;
    }
    let quantity = input.quantity;
    if (quantity > settings.maxQuantityPerLine) {
      issues.push({ variantId: input.variantId, type: 'QUANTITY_LIMIT', message: `You can buy up to ${settings.maxQuantityPerLine} of this item per order.`, available: maxQuantity });
      quantity = maxQuantity;
    }
    if (quantity > available) {
      issues.push({ variantId: input.variantId, type: 'INSUFFICIENT_STOCK', message: `Only ${available} left of ${v.product_name} (${v.color} / ${v.size}).`, available });
      quantity = available;
    }

    const originalUnitPrice = v.variant_price ?? v.product_price;
    const compareAtPrice = v.variant_compare_at ?? v.product_compare_at;
    const promo = bestPromotion(promos, { productId: v.product_id, categoryId: v.category_id, parentCategoryId: v.parent_category_id, brandId: v.brand_id, unitPrice: originalUnitPrice });
    const unitDiscount = promo?.amount ?? 0;
    const unitPrice = originalUnitPrice - unitDiscount;
    if (input.expectedUnitPrice !== undefined && input.expectedUnitPrice !== unitPrice) {
      issues.push({ variantId: input.variantId, type: 'PRICE_CHANGED', message: `The price of ${v.product_name} changed.`, newUnitPrice: unitPrice });
    }

    priced.push({
      variantId: v.variant_id,
      productId: v.product_id,
      productName: v.product_name,
      productSlug: v.product_slug,
      brandName: v.brand_name,
      categoryId: v.category_id,
      parentCategoryId: v.parent_category_id,
      sku: v.sku,
      color: v.color,
      colorHex: v.color_hex,
      size: v.size,
      imageUrl: v.image_url,
      quantity,
      originalUnitPrice,
      compareAtPrice: compareAtPrice && compareAtPrice > unitPrice ? compareAtPrice : unitDiscount > 0 ? originalUnitPrice : null,
      unitPrice,
      unitDiscount,
      lineSubtotal: originalUnitPrice * quantity,
      lineDiscount: unitDiscount * quantity,
      lineTotal: unitPrice * quantity,
      available,
      maxQuantity,
      appliedDiscount: promo ? { source: promo.promo.source, id: promo.promo.id, name: promo.promo.name } : null,
    });
  }

  const subtotal = priced.reduce((s, l) => s + l.lineSubtotal, 0);
  const productDiscount = priced.reduce((s, l) => s + l.lineDiscount, 0);
  const merchandiseTotal = subtotal - productDiscount;

  let coupon: PriceBreakdown['coupon'] = null;
  let couponDiscount = 0;
  if (opts.couponCode) {
    const res = await evaluateCoupon(db, opts.couponCode, {
      userId: opts.userId ?? null,
      merchandiseTotal,
      forUpdate: opts.lock,
      lines: priced.map((l) => ({ productId: l.productId, categoryId: l.categoryId, parentCategoryId: l.parentCategoryId, lineTotal: l.lineTotal })),
    });
    if (res.valid) {
      couponDiscount = res.discount;
      coupon = { code: res.coupon.code, valid: true, message: res.message, discount: res.discount, type: res.coupon.type, value: res.coupon.value, description: res.coupon.description };
    } else {
      coupon = { code: res.code, valid: false, message: res.message, discount: 0 };
    }
  }

  const afterCoupon = Math.max(0, merchandiseTotal - couponDiscount);
  let shipping: ShippingQuote | null = null;
  if (opts.shippingMethod && priced.length) {
    const method = await shippingService.requireMethod(opts.shippingMethod, db);
    shipping = shippingService.provider.quote({ method, merchandiseTotal: afterCoupon, storeFreeShippingThreshold: settings.freeShippingThreshold, city: opts.city });
  }
  const shippingFee = shipping?.fee ?? 0;
  const tax = taxOf(afterCoupon, settings.taxRate, settings.taxInclusive);
  const grandTotal = Math.max(0, afterCoupon + shippingFee + (settings.taxInclusive ? 0 : tax));
  const compareSavings = priced.reduce((s, l) => s + (l.compareAtPrice && l.compareAtPrice > l.originalUnitPrice ? (l.compareAtPrice - l.originalUnitPrice) * l.quantity : 0), 0);

  return {
    currency: settings.currency,
    lines: priced,
    issues,
    coupon,
    shipping,
    totals: {
      itemCount: priced.reduce((s, l) => s + l.quantity, 0),
      subtotal,
      productDiscount,
      merchandiseTotal,
      couponDiscount,
      shipping: shippingFee,
      tax,
      taxInclusive: settings.taxInclusive,
      grandTotal,
      savings: compareSavings + productDiscount + couponDiscount,
      freeShippingThreshold: settings.freeShippingThreshold,
      freeShippingRemaining: settings.freeShippingThreshold ? Math.max(0, settings.freeShippingThreshold - afterCoupon) : 0,
    },
  };
}

/** Throws the most relevant error when a breakdown is not purchasable as-is. */
export function assertPurchasable(b: PriceBreakdown): void {
  const stock = b.issues.find((i) => i.type === 'OUT_OF_STOCK' || i.type === 'INSUFFICIENT_STOCK');
  if (stock) throw new AppError('OUT_OF_STOCK', stock.message, { issues: b.issues });
  const other = b.issues.find((i) => i.type !== 'PRICE_CHANGED');
  if (other) throw new AppError('ORDER_INVALID', other.message, { issues: b.issues });
  if (!b.lines.length) throw new AppError('ORDER_INVALID', 'Your bag is empty.');
  if (b.coupon && !b.coupon.valid) throw new AppError('INVALID_COUPON', b.coupon.message, { code: b.coupon.code });
}
