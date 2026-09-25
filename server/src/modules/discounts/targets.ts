import { query, pool, type Db } from '../../config/database.js';
import { badRequest } from '../../utils/errors.js';

type Target = 'products' | 'categories' | 'brands';
const SQL: Record<Target, string> = {
  products: `select id::text from public.products where id = any($1::uuid[]) and deleted_at is null`,
  categories: `select id::text from public.categories where id = any($1::uuid[])`,
  brands: `select id::text from public.brands where id = any($1::uuid[])`,
};

/** Throws VALIDATION_ERROR listing ids that do not exist (products: soft-deleted count as missing). */
export async function assertTargetsExist(kind: Target, ids: string[], field: string, db: Db = pool) {
  const unique = [...new Set(ids)];
  if (!unique.length) return unique;
  const found = new Set((await query<{ id: string }>(SQL[kind], [unique], db)).map((r) => r.id));
  const missing = unique.filter((id) => !found.has(id));
  if (missing.length) throw badRequest(`Unknown ${kind}: ${missing.length} id(s) do not exist.`, { [field]: missing });
  return unique;
}

/** Derived lifecycle status shared by coupons and automatic discounts. */
export const PROMOTION_STATUSES = ['active', 'scheduled', 'expired', 'disabled'] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

/** SQL for the derived status. `usage` adds the coupon usage-limit rule. Column names are fixed identifiers. */
export const promotionStatusSql = (alias: string, usage = false) =>
  `case when not ${alias}.is_active then 'disabled'
        when (${alias}.ends_at is not null and ${alias}.ends_at <= now())${usage ? ` or (${alias}.usage_limit is not null and ${alias}.usage_count >= ${alias}.usage_limit)` : ''} then 'expired'
        when ${alias}.starts_at > now() then 'scheduled'
        else 'active' end`;
