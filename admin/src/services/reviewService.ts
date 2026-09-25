import type { ListParams, Paginated, ProductType, Review, ReviewStatus } from '@/types';
import { adminApi } from './api';
import { lower, opt, sortQuery } from './customerService';

interface ReviewDto {
  id: string;
  productId: string;
  productName: string | null;
  productSlug: string | null;
  productType: string | null;
  productImage: string | null;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  orderId: string | null;
  orderNumber: string | null;
  rating: number;
  title: string;
  comment: string;
  fit: 'small' | 'true' | 'large' | null;
  size: string | null;
  status: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  moderatedAt: string | null;
  moderatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function toReview(d: ReviewDto): Review {
  return {
    id: d.id,
    productId: d.productId,
    productName: d.productName ?? 'Deleted product',
    productSlug: opt(d.productSlug),
    productType: d.productType ? (d.productType.toLowerCase() as ProductType) : undefined,
    productImage: opt(d.productImage),
    customerId: d.customerId,
    customerName: d.customerName || 'Customer',
    customerEmail: opt(d.customerEmail),
    orderId: opt(d.orderId),
    orderNumber: opt(d.orderNumber),
    rating: Math.min(5, Math.max(1, d.rating)) as Review['rating'],
    title: d.title,
    body: d.comment,
    fit: opt(d.fit),
    size: opt(d.size),
    status: lower<ReviewStatus>(d.status, 'pending'),
    verifiedPurchase: d.verifiedPurchase,
    helpfulCount: d.helpfulCount,
    moderatedAt: opt(d.moderatedAt),
    moderatedBy: opt(d.moderatedBy),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export interface ReviewFilters {
  status?: ReviewStatus | '';
  rating?: number | '';
  productId?: string;
  customerId?: string;
  /** YYYY-MM-DD or ISO — reviews submitted on/after. */
  from?: string;
}

export interface ReviewListParams extends ListParams {
  filters?: ReviewFilters;
}

export type ReviewCounts = Record<'all' | ReviewStatus, number>;

export interface ReviewPage extends Paginated<Review> {
  /** Per-status totals for the other filters (ignores the status filter) — drives the tabs. */
  counts: ReviewCounts;
}

/** Table column id → server sort key. */
const REVIEW_SORT: Record<string, string> = { date: 'created_at', rating: 'rating', helpful: 'helpful_count', moderated: 'moderated_at' };

export const reviewService = {
  /** GET /admin/reviews */
  async getReviews({ page = 1, pageSize = 25, search, sortBy, sortDir, filters = {} }: ReviewListParams = {}): Promise<ReviewPage> {
    const res = await adminApi.page<ReviewDto, { counts?: Record<string, number> }>('/reviews', {
      page,
      limit: pageSize,
      search: search?.trim() || undefined,
      status: filters.status || undefined,
      rating: filters.rating || undefined,
      productId: filters.productId || undefined,
      customerId: filters.customerId || undefined,
      date_from: filters.from ? filters.from.slice(0, 10) : undefined,
      ...sortQuery(REVIEW_SORT, sortBy, sortDir),
    });
    const c = res.counts ?? {};
    return {
      data: res.data.map(toReview),
      total: res.pagination.total,
      page: res.pagination.page,
      pageSize: res.pagination.limit,
      counts: { all: c.ALL ?? 0, pending: c.PENDING ?? 0, approved: c.APPROVED ?? 0, rejected: c.REJECTED ?? 0, hidden: c.HIDDEN ?? 0 },
    };
  },

  /** GET /admin/reviews/:id */
  async getReview(id: string): Promise<Review> {
    return toReview(await adminApi.get<ReviewDto>(`/reviews/${id}`));
  },

  /** PATCH /admin/reviews/:id/status */
  async updateReviewStatus(id: string, status: ReviewStatus): Promise<Review> {
    return toReview(await adminApi.patch<ReviewDto>(`/reviews/${id}/status`, { status: status.toUpperCase() }));
  },

  /** PATCH /admin/reviews/bulk — returns the number of reviews changed. */
  async bulkUpdateStatus(ids: string[], status: ReviewStatus): Promise<number> {
    const res = await adminApi.patch<{ updated: number }>('/reviews/bulk', { ids, status: status.toUpperCase() });
    return res.updated;
  },

  /** DELETE /admin/reviews/:id */
  async deleteReview(id: string): Promise<void> {
    await adminApi.delete(`/reviews/${id}`);
  },

  /** Product picker options for the review filter (GET /admin/products, name only). */
  async getProductOptions(): Promise<{ value: string; label: string }[]> {
    const res = await adminApi.page<{ id: string; name: string }>('/products', { page: 1, limit: 100, sort: 'name', order: 'asc' });
    return res.data.map((p) => ({ value: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label));
  },
};
