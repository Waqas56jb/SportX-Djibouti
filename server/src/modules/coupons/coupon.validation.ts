import { queryOne, type Db } from '../../config/database.js';
import { discountAmount } from '../../utils/price.js';
import type { DiscountType } from '../../types/common.js';

export interface CouponRow {
  id: string;
  code: string;
  description: string;
  type: DiscountType;
  value: number;
  minimum_order_amount: number;
  maximum_discount: number | null;
  starts_at: Date;
  ends_at: Date | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  usage_count: number;
  is_active: boolean;
  category_ids: string[];
  product_ids: string[];
  customer_groups: string[];
}

export interface CouponLine {
  productId: string;
  categoryId: string;
  parentCategoryId: string | null;
  lineTotal: number;
}

export type CouponResult =
  | { valid: true; coupon: CouponRow; discount: number; eligibleAmount: number; message: string }
  | { valid: false; code: string; message: string };

const fmt = (n: number) => `DJF ${n.toLocaleString('en-US')}`;

/**
 * Server-side coupon validation. `forUpdate` locks the coupon row (use inside the order
 * transaction) so usage limits cannot be exceeded by concurrent checkouts.
 */
export async function evaluateCoupon(
  db: Db,
  rawCode: string,
  ctx: { userId: string | null; lines: CouponLine[]; merchandiseTotal: number; forUpdate?: boolean },
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  const invalid = (message: string): CouponResult => ({ valid: false, code, message });
  const c = await queryOne<CouponRow>(
    `select * from public.coupons where code = $1 and deleted_at is null ${ctx.forUpdate ? 'for update' : ''}`,
    [code],
    db,
  );
  if (!c || !c.is_active) return invalid('This code is not valid.');
  const now = Date.now();
  if (new Date(c.starts_at).getTime() > now) return invalid('This code is not active yet.');
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return invalid('This code has expired.');
  if (c.usage_limit != null && c.usage_count >= c.usage_limit) return invalid('This code has reached its usage limit.');

  if (c.per_user_limit != null || c.customer_groups.length) {
    if (!ctx.userId) return invalid('Sign in to use this code.');
  }
  if (c.per_user_limit != null && ctx.userId) {
    const used = await queryOne<{ n: number }>(`select count(*)::int as n from public.coupon_usages where coupon_id = $1 and user_id = $2`, [c.id, ctx.userId], db);
    if ((used?.n ?? 0) >= c.per_user_limit) return invalid('You have already used this code the maximum number of times.');
  }
  if (c.customer_groups.length && ctx.userId) {
    const stats = await queryOne<{ orders: number; spent: number; joined_days: number; last_order_days: number | null }>(
      `select (select count(*)::int from public.orders o where o.user_id = u.id and o.status not in ('CANCELLED') and o.deleted_at is null) as orders,
              (select coalesce(sum(o.grand_total - o.refunded_total), 0) from public.orders o where o.user_id = u.id and o.payment_status in ('PAID', 'PARTIALLY_REFUNDED')) as spent,
              extract(day from now() - u.created_at)::int as joined_days,
              (select extract(day from now() - max(o.created_at))::int from public.orders o where o.user_id = u.id) as last_order_days
         from public.users u where u.id = $1`,
      [ctx.userId],
      db,
    );
    const groups = new Set<string>(['all']);
    if (stats) {
      if (stats.joined_days <= 30) groups.add('new'); // same rule as the admin customer groups
      if (stats.orders >= 2) groups.add('returning');
      if (stats.spent >= 80_000) groups.add('high_value');
      if (stats.last_order_days === null ? stats.joined_days > 60 : stats.last_order_days > 60) groups.add('inactive');
    }
    if (!c.customer_groups.some((g) => groups.has(g))) return invalid('This code is not available for your account.');
  }

  const restricted = c.product_ids.length > 0 || c.category_ids.length > 0;
  const eligible = restricted
    ? ctx.lines.filter((l) => c.product_ids.includes(l.productId) || c.category_ids.includes(l.categoryId) || (l.parentCategoryId !== null && c.category_ids.includes(l.parentCategoryId)))
    : ctx.lines;
  const eligibleAmount = eligible.reduce((s, l) => s + l.lineTotal, 0);
  if (eligibleAmount <= 0) return invalid('This code does not apply to the items in your bag.');
  if (ctx.merchandiseTotal < c.minimum_order_amount) return invalid(`This code requires a minimum order of ${fmt(c.minimum_order_amount)}.`);

  const discount = Math.min(ctx.merchandiseTotal, discountAmount(eligibleAmount, c.type, c.value, c.maximum_discount));
  return { valid: true, coupon: c, discount, eligibleAmount, message: c.description || 'Code applied.' };
}
