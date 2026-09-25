import type { Review, ReviewStatus } from '@/types';
import { appConfig } from '@/constants/config';
import { api } from './http';
import { audit, db, delay, getActor, matches, NotFoundError, now } from './mock/db';

export interface ReviewFilters {
  search?: string;
  status?: ReviewStatus | '';
  rating?: number | '';
  productId?: string;
  customerId?: string;
  from?: string;
}

const LABEL: Record<ReviewStatus, string> = { approved: 'Review approved', rejected: 'Review rejected', hidden: 'Review hidden', pending: 'Review reset to pending' };

export const reviewService = {
  /** GET /reviews */
  async getReviews(filters: ReviewFilters = {}): Promise<Review[]> {
    if (!appConfig.useMocks) return api.get<Review[]>('/reviews', { ...filters });
    const list = db.reviews
      .filter((r) => matches([r.productName, r.customerName, r.title, r.body], filters.search))
      .filter((r) => !filters.status || r.status === filters.status)
      .filter((r) => !filters.rating || r.rating === Number(filters.rating))
      .filter((r) => !filters.productId || r.productId === filters.productId)
      .filter((r) => !filters.customerId || r.customerId === filters.customerId)
      .filter((r) => !filters.from || r.createdAt >= filters.from)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return delay(list);
  },

  /** PATCH /reviews/:id/status */
  async updateReviewStatus(id: string, status: ReviewStatus): Promise<Review> {
    if (!appConfig.useMocks) return api.patch<Review>(`/reviews/${id}/status`, { status });
    const r = db.reviews.find((x) => x.id === id);
    if (!r) throw new NotFoundError('Review');
    r.status = status;
    r.moderatedAt = now();
    r.moderatedBy = getActor().name;
    audit(LABEL[status], 'Reviews', `Review on ${r.productName}`, '/reviews');
    return delay(r, 300);
  },

  /** PATCH /reviews/bulk */
  async bulkUpdateStatus(ids: string[], status: ReviewStatus): Promise<void> {
    if (!appConfig.useMocks) return api.patch('/reviews/bulk', { ids, status });
    for (const r of db.reviews) if (ids.includes(r.id)) {
      r.status = status;
      r.moderatedAt = now();
      r.moderatedBy = getActor().name;
    }
    audit(`${ids.length} reviews ${status}`, 'Reviews', `${ids.length} review(s)`, '/reviews');
    await delay(null);
  },

  /** DELETE /reviews/:id */
  async deleteReview(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.delete(`/reviews/${id}`);
    const r = db.reviews.find((x) => x.id === id);
    if (!r) throw new NotFoundError('Review');
    db.reviews = db.reviews.filter((x) => x.id !== id);
    audit('Review deleted', 'Reviews', `Review on ${r.productName}`);
    await delay(null);
  },
};
