import { z } from 'zod';
import type { Request } from 'express';
import { query, queryOne, withTransaction } from '../../config/database.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { adminListQuery, dateBounds, offsetOf } from '../../utils/pagination.js';
import { audit } from '../../services/audit.service.js';
import { isoDate, iso, lowerEnum, upperEnum } from '../reports/zod-helpers.js';
import { assertTargetsExist, PROMOTION_STATUSES, promotionStatusSql } from '../discounts/targets.js';

const CUSTOMER_GROUPS = ['all', 'new', 'returning', 'high_value', 'inactive'] as const;

interface Row {
  id: string;
  code: string;
  description: string;
  type: 'PERCENTAGE' | 'FIXED';
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
  created_at: Date;
  updated_at: Date;
  status: string;
  created_by_name: string | null;
  discount_total?: number;
}

function toCoupon(r: Row) {
  return {
    id: r.id,
    code: r.code,
    description: r.description,
    type: r.type,
    value: r.value,
    minOrder: r.minimum_order_amount,
    maxDiscount: r.maximum_discount,
    usageLimit: r.usage_limit,
    perCustomerLimit: r.per_user_limit,
    usageCount: r.usage_count,
    discountTotal: r.discount_total ?? 0,
    startsAt: iso(r.starts_at)!,
    endsAt: iso(r.ends_at),
    enabled: r.is_active,
    status: r.status,
    categoryIds: r.category_ids,
    productIds: r.product_ids,
    customerGroups: r.customer_groups,
    createdBy: r.created_by_name,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

const SELECT = `select c.*, ${promotionStatusSql('c', true)} as status,
    nullif(trim(u.first_name || ' ' || u.last_name), '') as created_by_name,
    (select coalesce(sum(cu.discount_amount), 0) from public.coupon_usages cu where cu.coupon_id = c.id) as discount_total
  from public.coupons c left join public.users u on u.id = c.created_by`;

export const couponListQuery = adminListQuery(['created_at', 'code', 'usage_count', 'starts_at', 'ends_at', 'value']).extend({
  status: lowerEnum([...PROMOTION_STATUSES]).optional(),
  type: upperEnum(['PERCENTAGE', 'FIXED']).optional(),
});
export type CouponListQuery = z.infer<typeof couponListQuery>;

export async function listCoupons(f: CouponListQuery) {
  const where = ['c.deleted_at is null'];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (f.search) add('(c.code ilike ? or c.description ilike ?)', `%${f.search}%`);
  if (f.status) add(`(${promotionStatusSql('c', true)}) = ?`, f.status);
  if (f.type) add('c.type = ?::public.discount_type', f.type);
  const { from, to } = dateBounds(f.date_from, f.date_to);
  if (from) add('c.created_at >= ?', from);
  if (to) add('c.created_at <= ?', to);
  const n = params.length;
  const rows = await query<Row & { total: number }>(
    `${SELECT.replace('select c.*,', 'select c.*, count(*) over ()::int as total,')} where ${where.join(' and ')}
      order by c.${f.sort ?? 'created_at'} ${f.order}, c.id limit $${n + 1} offset $${n + 2}`,
    [...params, f.limit, offsetOf(f.page, f.limit)],
  );
  const total = rows[0]?.total ?? (await queryOne<{ n: number }>(`select count(*)::int as n from public.coupons c where ${where.join(' and ')}`, params))!.n;
  const counts = await queryOne<Record<string, number>>(
    `select count(*)::int as "all", ${PROMOTION_STATUSES.map((s) => `count(*) filter (where (${promotionStatusSql('c', true)}) = '${s}')::int as ${s}`).join(', ')}
       from public.coupons c where c.deleted_at is null`,
  );
  return { rows: rows.map(toCoupon), total, counts };
}

export async function getCoupon(id: string) {
  const r = await queryOne<Row>(`${SELECT} where c.id = $1 and c.deleted_at is null`, [id]);
  if (!r) throw notFound('Coupon');
  return toCoupon(r);
}

const nullableInt = (min: number) => z.number().int().min(min).max(1_000_000_000).nullable().optional();

/** Accepts the admin UI's field names; unknown keys are stripped. */
export const couponBody = z.object({
  code: z.string().trim().min(3).max(32).transform((s) => s.toUpperCase()).optional(),
  description: z.string().trim().max(300).optional(),
  type: upperEnum(['PERCENTAGE', 'FIXED']).optional(),
  value: z.number().int().positive().max(1_000_000_000).optional(),
  minOrder: z.number().int().min(0).max(1_000_000_000).optional(),
  minimumOrderAmount: z.number().int().min(0).max(1_000_000_000).optional(),
  maxDiscount: nullableInt(1),
  maximumDiscount: nullableInt(1),
  usageLimit: nullableInt(1),
  perCustomerLimit: nullableInt(1),
  perUserLimit: nullableInt(1),
  startsAt: isoDate().optional(),
  endsAt: isoDate().nullable().optional(),
  enabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
  categoryIds: z.array(z.string().uuid()).max(200).optional(),
  productIds: z.array(z.string().uuid()).max(500).optional(),
  customerGroups: z.array(lowerEnum([...CUSTOMER_GROUPS])).max(5).optional(),
});
export type CouponBody = z.infer<typeof couponBody>;

interface CouponState {
  code: string;
  description: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minimum_order_amount: number;
  maximum_discount: number | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  category_ids: string[];
  product_ids: string[];
  customer_groups: string[];
}

function merge(b: CouponBody, cur?: CouponState): CouponState {
  const pick = <T>(...vals: (T | undefined)[]) => vals.find((v) => v !== undefined);
  const groups = pick(b.customerGroups, cur?.customer_groups) ?? [];
  return {
    code: pick(b.code, cur?.code) ?? '',
    description: pick(b.description, cur?.description) ?? '',
    type: pick(b.type, cur?.type) as CouponState['type'],
    value: pick(b.value, cur?.value) as number,
    minimum_order_amount: pick(b.minOrder, b.minimumOrderAmount, cur?.minimum_order_amount) ?? 0,
    maximum_discount: pick(b.maxDiscount, b.maximumDiscount, cur?.maximum_discount) ?? null,
    usage_limit: pick(b.usageLimit, cur?.usage_limit) ?? null,
    per_user_limit: pick(b.perCustomerLimit, b.perUserLimit, cur?.per_user_limit) ?? null,
    starts_at: pick(b.startsAt, cur?.starts_at) ?? new Date().toISOString(),
    ends_at: pick(b.endsAt, cur?.ends_at) ?? null,
    is_active: pick(b.enabled, b.isActive, cur?.is_active) ?? true,
    category_ids: pick(b.categoryIds, cur?.category_ids) ?? [],
    product_ids: pick(b.productIds, cur?.product_ids) ?? [],
    // "all" is the same as no restriction.
    customer_groups: groups.includes('all') ? [] : [...new Set(groups)],
  };
}

async function validateCoupon(s: CouponState, excludeId?: string) {
  const errors: Record<string, string> = {};
  if (!/^[A-Z0-9_-]{3,32}$/.test(s.code)) errors.code = 'Use 3–32 letters, digits, "-" or "_".';
  if (!s.type) errors.type = 'Type is required.';
  if (!s.value || s.value <= 0) errors.value = 'Value must be greater than zero.';
  if (s.type === 'PERCENTAGE' && s.value > 100) errors.value = 'A percentage discount cannot exceed 100.';
  if (s.type === 'FIXED' && s.maximum_discount !== null) errors.maxDiscount = 'A maximum discount only applies to percentage coupons.';
  if (s.ends_at && new Date(s.ends_at).getTime() <= new Date(s.starts_at).getTime()) errors.endsAt = 'End date must be after the start date.';
  if (s.per_user_limit !== null && s.usage_limit !== null && s.per_user_limit > s.usage_limit) errors.perCustomerLimit = 'Per-customer limit cannot exceed the total usage limit.';
  if (Object.keys(errors).length) throw badRequest('Coupon validation failed.', errors);
  const dup = await queryOne(`select 1 from public.coupons where code = $1 and deleted_at is null and ($2::uuid is null or id <> $2::uuid)`, [s.code, excludeId ?? null]);
  if (dup) throw conflict(`Coupon code ${s.code} already exists.`, { code: 'code_taken' });
  s.category_ids = await assertTargetsExist('categories', s.category_ids, 'categoryIds');
  s.product_ids = await assertTargetsExist('products', s.product_ids, 'productIds');
}

const COLS = [
  'code', 'description', 'type', 'value', 'minimum_order_amount', 'maximum_discount', 'usage_limit', 'per_user_limit',
  'starts_at', 'ends_at', 'is_active', 'category_ids', 'product_ids', 'customer_groups',
] as const;
const values = (s: CouponState) => COLS.map((c) => s[c]);

export async function createCoupon(req: Request, b: CouponBody) {
  if (b.code === undefined || b.type === undefined || b.value === undefined) throw badRequest('code, type and value are required.');
  const s = merge(b);
  await validateCoupon(s);
  const id = await withTransaction(async (tx) => {
    const r = await queryOne<{ id: string }>(
      `insert into public.coupons (${COLS.join(', ')}, created_by)
       values ($1, $2, $3::public.discount_type, $4, $5, $6, $7, $8, $9, $10, $11, $12::uuid[], $13::uuid[], $14::text[], $15) returning id`,
      [...values(s), req.auth!.userId],
      tx,
    );
    await audit(req, { action: 'Coupon created', entityType: 'coupon', entityId: r!.id, metadata: { code: s.code, type: s.type, value: s.value } }, tx);
    return r!.id;
  });
  return getCoupon(id);
}

export async function updateCoupon(req: Request, id: string, b: CouponBody) {
  const cur = await queryOne<CouponState & { starts_at: Date; ends_at: Date | null; usage_count: number }>(
    `select ${COLS.join(', ')}, usage_count from public.coupons where id = $1 and deleted_at is null`,
    [id],
  );
  if (!cur) throw notFound('Coupon');
  const s = merge(b, { ...cur, starts_at: iso(cur.starts_at)!, ends_at: iso(cur.ends_at) });
  await validateCoupon(s, id);
  if (s.code !== cur.code && cur.usage_count > 0) throw conflict('This coupon has already been used; its code cannot be changed. Create a new coupon instead.');
  const onlyToggle = Object.keys(b).every((k) => k === 'enabled' || k === 'isActive') && s.is_active !== cur.is_active;
  await withTransaction(async (tx) => {
    await query(
      `update public.coupons set code = $1, description = $2, type = $3::public.discount_type, value = $4, minimum_order_amount = $5, maximum_discount = $6,
              usage_limit = $7, per_user_limit = $8, starts_at = $9, ends_at = $10, is_active = $11, category_ids = $12::uuid[],
              product_ids = $13::uuid[], customer_groups = $14::text[]
        where id = $15`,
      [...values(s), id],
      tx,
    );
    await audit(
      req,
      {
        action: onlyToggle ? (s.is_active ? 'Coupon enabled' : 'Coupon disabled') : 'Coupon updated',
        entityType: 'coupon',
        entityId: id,
        metadata: { code: s.code, fields: Object.keys(b) },
      },
      tx,
    );
  });
  return getCoupon(id);
}

/** Soft delete: usage history stays intact and the code becomes reusable. */
export async function deleteCoupon(req: Request, id: string) {
  await withTransaction(async (tx) => {
    const r = await queryOne<{ code: string }>(`update public.coupons set deleted_at = now(), is_active = false where id = $1 and deleted_at is null returning code`, [id], tx);
    if (!r) throw notFound('Coupon');
    await audit(req, { action: 'Coupon deleted', entityType: 'coupon', entityId: id, metadata: { code: r.code } }, tx);
  });
}

export async function couponUsages(id: string, page: number, limit: number) {
  const exists = await queryOne(`select 1 from public.coupons where id = $1`, [id]);
  if (!exists) throw notFound('Coupon');
  const rows = await query<{ id: string; order_id: string; order_number: string | null; user_id: string | null; customer_name: string | null; email: string | null; discount_amount: number; grand_total: number | null; created_at: Date; total: number }>(
    `select cu.id, cu.order_id, o.order_number, cu.user_id, nullif(trim(coalesce(u.first_name, o.customer_first_name) || ' ' || coalesce(u.last_name, o.customer_last_name)), '') as customer_name,
            coalesce(u.email, o.email) as email, cu.discount_amount, o.grand_total, cu.created_at, count(*) over ()::int as total
       from public.coupon_usages cu left join public.orders o on o.id = cu.order_id left join public.users u on u.id = cu.user_id
      where cu.coupon_id = $1 order by cu.created_at desc, cu.id limit $2 offset $3`,
    [id, limit, offsetOf(page, limit)],
  );
  const total = rows[0]?.total ?? (await queryOne<{ n: number }>(`select count(*)::int as n from public.coupon_usages where coupon_id = $1`, [id]))!.n;
  return {
    rows: rows.map((r) => ({
      id: r.id,
      orderId: r.order_id,
      orderNumber: r.order_number,
      customerId: r.user_id,
      customerName: r.customer_name,
      email: r.email,
      discountAmount: r.discount_amount,
      orderTotal: r.grand_total,
      createdAt: iso(r.created_at)!,
    })),
    total,
  };
}
