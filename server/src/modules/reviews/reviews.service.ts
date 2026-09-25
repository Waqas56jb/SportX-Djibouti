import type { Request } from 'express';
import { query, queryOne, withTransaction } from '../../config/database.js';
import { conflict, forbidden, notFound } from '../../utils/errors.js';
import { dateBounds, offsetOf, pageMeta } from '../../utils/pagination.js';
import { audit } from '../../services/audit.service.js';
import { notificationService } from '../../services/notification/notification.service.js';
import { resolvePublishedProduct } from '../account/products.js';
import { toAdminReview, toOwnReview, toPublicReview, type ReviewRow } from './reviews.mapper.js';
import type { AdminReviewsQuery, ProductReviewsQuery } from './reviews.schema.js';
import type { ReviewStatus } from '../../types/common.js';

const PUBLIC_SORT: Record<ProductReviewsQuery['sort'], string> = {
  newest: 'r.created_at desc, r.id',
  highest: 'r.rating desc, r.created_at desc, r.id',
  lowest: 'r.rating asc, r.created_at desc, r.id',
  helpful: 'r.helpful_count desc, r.created_at desc, r.id',
};

const ADMIN_SELECT = `select r.*, u.first_name, u.last_name, u.email, p.name as product_name, p.slug as product_slug, p.product_type,
    (select pi.url from public.product_images pi where pi.product_id = p.id order by (pi.role = 'MAIN') desc, pi.position limit 1) as product_image,
    o.order_number, nullif(trim(m.first_name || ' ' || m.last_name), '') as moderator_name
  from public.reviews r
  join public.users u on u.id = r.user_id
  join public.products p on p.id = r.product_id
  left join public.orders o on o.id = r.order_id
  left join public.users m on m.id = r.moderated_by`;

export interface ReviewInput {
  rating: number;
  title: string;
  comment: string;
  fit?: 'small' | 'true' | 'large' | null;
  size?: string | null;
}

async function ownReview(userId: string, id: string) {
  const row = await queryOne<ReviewRow>(
    `select r.*, u.first_name, u.last_name, p.name as product_name, p.slug as product_slug,
            (select pi.url from public.product_images pi where pi.product_id = p.id order by (pi.role = 'MAIN') desc, pi.position limit 1) as product_image
       from public.reviews r join public.users u on u.id = r.user_id join public.products p on p.id = r.product_id
      where r.id = $1 and r.user_id = $2 and r.deleted_at is null`,
    [id, userId],
  );
  if (!row) throw notFound('Review');
  return row;
}

export const reviewsService = {
  // ─── Public ───────────────────────────────────────────────────────────────
  async forProduct(productRef: string, q: ProductReviewsQuery) {
    const product = await resolvePublishedProduct(productRef);
    const filter = q.rating ? 'and r.rating = $2' : '';
    const params: unknown[] = q.rating ? [product.id, q.rating] : [product.id];
    const [rows, total, dist] = await Promise.all([
      query<ReviewRow>(
        `select r.*, u.first_name, u.last_name from public.reviews r join public.users u on u.id = r.user_id
          where r.product_id = $1 and r.status = 'APPROVED' and r.deleted_at is null ${filter}
          order by ${PUBLIC_SORT[q.sort]} limit ${q.limit} offset ${offsetOf(q.page, q.limit)}`,
        params,
      ),
      queryOne<{ n: number }>(`select count(*)::int as n from public.reviews r where r.product_id = $1 and r.status = 'APPROVED' and r.deleted_at is null ${filter}`, params),
      query<{ rating: number; n: number }>(
        `select rating, count(*)::int as n from public.reviews where product_id = $1 and status = 'APPROVED' and deleted_at is null group by rating`,
        [product.id],
      ),
    ]);
    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of dist) distribution[d.rating as 1 | 2 | 3 | 4 | 5] = d.n;
    const count = dist.reduce((s, d) => s + d.n, 0);
    const sum = dist.reduce((s, d) => s + d.n * d.rating, 0);
    return {
      productId: product.id,
      reviews: rows.map(toPublicReview),
      summary: { average: count ? Math.round((sum / count) * 10) / 10 : 0, total: count, distribution },
      pagination: pageMeta(q.page, q.limit, total?.n ?? 0),
    };
  },

  // ─── Customer ─────────────────────────────────────────────────────────────
  /** Only customers who received the product (a DELIVERED order containing it) may review it — once. */
  async create(userId: string, productRef: string, input: ReviewInput) {
    const product = await resolvePublishedProduct(productRef);
    const id = await withTransaction(async (tx) => {
      const order = await queryOne<{ id: string }>(
        `select o.id from public.orders o join public.order_items i on i.order_id = o.id
          where o.user_id = $1 and i.product_id = $2 and o.status = 'DELIVERED' and o.deleted_at is null
          order by o.placed_at desc limit 1`,
        [userId, product.id],
        tx,
      );
      if (!order) throw forbidden('You can review products you have received.');
      const existing = await queryOne(`select 1 from public.reviews where product_id = $1 and user_id = $2 and deleted_at is null`, [product.id, userId], tx);
      if (existing) throw conflict('You have already reviewed this product.');
      const row = await queryOne<{ id: string }>(
        `insert into public.reviews (product_id, user_id, order_id, rating, title, comment, fit, size, status, verified_purchase)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', true) returning id`,
        [product.id, userId, order.id, input.rating, input.title, input.comment, input.fit ?? null, input.size ?? null],
        tx,
      );
      await notificationService.toStaff(
        { type: 'REVIEW_PENDING', title: 'Review awaiting moderation', message: `${input.rating}★ review on ${product.name}.`, link: `/reviews?status=PENDING`, data: { reviewId: row!.id, productId: product.id } },
        tx,
      );
      return row!.id;
    });
    return toOwnReview(await ownReview(userId, id));
  },

  async mine(userId: string) {
    const rows = await query<ReviewRow>(
      `select r.*, u.first_name, u.last_name, p.name as product_name, p.slug as product_slug,
              (select pi.url from public.product_images pi where pi.product_id = p.id order by (pi.role = 'MAIN') desc, pi.position limit 1) as product_image
         from public.reviews r join public.users u on u.id = r.user_id join public.products p on p.id = r.product_id
        where r.user_id = $1 and r.deleted_at is null order by r.created_at desc`,
      [userId],
    );
    return rows.map(toOwnReview);
  },

  /** Editing sends the review back to moderation. */
  async update(userId: string, id: string, input: Partial<ReviewInput>) {
    await ownReview(userId, id);
    const sets: string[] = [`status = 'PENDING'`, 'moderated_by = null', 'moderated_at = null'];
    const params: unknown[] = [id, userId];
    const map: [keyof ReviewInput, string][] = [
      ['rating', 'rating'],
      ['title', 'title'],
      ['comment', 'comment'],
      ['fit', 'fit'],
      ['size', 'size'],
    ];
    for (const [key, col] of map) {
      if (input[key] === undefined) continue;
      params.push(input[key] ?? null);
      sets.push(`${col} = $${params.length}`);
    }
    await query(`update public.reviews set ${sets.join(', ')} where id = $1 and user_id = $2 and deleted_at is null`, params);
    await notificationService.toStaff({ type: 'REVIEW_PENDING', title: 'Edited review awaiting moderation', message: 'A customer edited their review.', link: `/reviews?status=PENDING`, data: { reviewId: id } });
    return toOwnReview(await ownReview(userId, id));
  },

  async removeOwn(userId: string, id: string) {
    const row = await queryOne(`update public.reviews set deleted_at = now() where id = $1 and user_id = $2 and deleted_at is null returning id`, [id, userId]);
    if (!row) throw notFound('Review');
  },

  // ─── Admin ────────────────────────────────────────────────────────────────
  async adminList(q: AdminReviewsQuery) {
    const where: string[] = ['r.deleted_at is null'];
    const params: unknown[] = [];
    const add = (sql: (n: string) => string, value: unknown) => {
      params.push(value);
      where.push(sql(`$${params.length}`));
    };
    const productId = q.productId ?? q.product;
    if (q.rating) add((n) => `r.rating = ${n}`, q.rating);
    if (productId) add((n) => `r.product_id = ${n}::uuid`, productId);
    if (q.customerId) add((n) => `r.user_id = ${n}::uuid`, q.customerId);
    if (q.search) add((n) => `(r.title ilike ${n} or r.comment ilike ${n} or p.name ilike ${n} or (u.first_name || ' ' || u.last_name) ilike ${n} or u.email ilike ${n})`, `%${q.search.replace(/[%_\\]/g, '\\$&')}%`);
    const { from, to } = dateBounds(q.date_from ?? q.from, q.date_to);
    if (from) add((n) => `r.created_at >= ${n}::timestamptz`, from);
    if (to) add((n) => `r.created_at <= ${n}::timestamptz`, to);

    // Counts per status ignore the status filter itself (tabs).
    const baseWhere = where.join(' and ');
    const baseParams = [...params];
    if (q.status) add((n) => `r.status = ${n}::public.review_status`, q.status);
    const whereSql = where.join(' and ');
    const sortCol = q.sort ?? 'created_at';
    const from_ = `from public.reviews r join public.users u on u.id = r.user_id join public.products p on p.id = r.product_id`;

    const [rows, total, counts] = await Promise.all([
      query<ReviewRow>(`${ADMIN_SELECT} where ${whereSql} order by r.${sortCol} ${q.order === 'asc' ? 'asc' : 'desc'} nulls last, r.id limit ${q.limit} offset ${offsetOf(q.page, q.limit)}`, params),
      queryOne<{ n: number }>(`select count(*)::int as n ${from_} where ${whereSql}`, params),
      query<{ status: ReviewStatus; n: number }>(`select r.status, count(*)::int as n ${from_} where ${baseWhere} group by r.status`, baseParams),
    ]);
    const statusCounts: Record<ReviewStatus | 'ALL', number> = { ALL: 0, PENDING: 0, APPROVED: 0, REJECTED: 0, HIDDEN: 0 };
    for (const c of counts) {
      statusCounts[c.status] = c.n;
      statusCounts.ALL += c.n;
    }
    return { rows: rows.map(toAdminReview), meta: pageMeta(q.page, q.limit, total?.n ?? 0), counts: statusCounts };
  },

  async adminGet(id: string) {
    const row = await queryOne<ReviewRow>(`${ADMIN_SELECT} where r.id = $1 and r.deleted_at is null`, [id]);
    if (!row) throw notFound('Review');
    return toAdminReview(row);
  },

  async setStatus(req: Request, id: string, status: ReviewStatus) {
    await withTransaction(async (tx) => {
      const prev = await queryOne<{ status: ReviewStatus; product_id: string }>(`select status, product_id from public.reviews where id = $1 and deleted_at is null for update`, [id], tx);
      if (!prev) throw notFound('Review');
      await query(`update public.reviews set status = $2::public.review_status, moderated_by = $3, moderated_at = now() where id = $1`, [id, status, req.auth!.userId], tx);
      await audit(req, { action: `Review ${status === 'PENDING' ? 'reset to pending' : status.toLowerCase()}`, entityType: 'review', entityId: id, metadata: { from: prev.status, to: status, productId: prev.product_id } }, tx);
    });
    return this.adminGet(id);
  },

  async bulkStatus(req: Request, ids: string[], status: ReviewStatus) {
    const updated = await withTransaction(async (tx) => {
      const rows = await query<{ id: string }>(
        `update public.reviews set status = $2::public.review_status, moderated_by = $3, moderated_at = now()
          where id = any($1::uuid[]) and deleted_at is null returning id`,
        [ids, status, req.auth!.userId],
        tx,
      );
      await audit(req, { action: `Reviews bulk ${status.toLowerCase()}`, entityType: 'review', entityId: null, metadata: { ids: rows.map((r) => r.id), status } }, tx);
      return rows.length;
    });
    return { updated, status };
  },

  async adminDelete(req: Request, id: string) {
    await withTransaction(async (tx) => {
      const row = await queryOne<{ product_id: string }>(`update public.reviews set deleted_at = now() where id = $1 and deleted_at is null returning product_id`, [id], tx);
      if (!row) throw notFound('Review');
      await audit(req, { action: 'Review deleted', entityType: 'review', entityId: id, metadata: { productId: row.product_id } }, tx);
    });
  },
};
