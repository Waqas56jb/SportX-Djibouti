import { REVIEWS_PAGE_SIZE } from '@/constants/commerce';
import type { RatingSummary, Review, ReviewInput, ReviewSort } from '@/types';
import type { Pagination } from './api';
import { api } from './api';

interface ApiReview {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string;
  comment: string;
  body?: string;
  fit: Review['fit'] | null;
  size: string | null;
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  product?: { id: string; name: string; slug: string | null; image: string | null };
}

export interface ProductReviews {
  reviews: Review[];
  summary: RatingSummary;
  pagination: Pagination;
}

export const toReview = (r: ApiReview): Review => ({
  id: r.id,
  productId: r.productId,
  author: r.author,
  rating: r.rating,
  title: r.title,
  body: r.body ?? r.comment,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  verified: Boolean(r.verifiedPurchase),
  size: r.size ?? undefined,
  fit: r.fit ?? undefined,
  helpfulCount: r.helpfulCount,
  status: r.status,
  product: r.product,
});

export interface ReviewQuery {
  page?: number;
  limit?: number;
  sort?: ReviewSort;
  rating?: number;
}

export const reviewService = {
  /** Approved reviews for a product (id or slug), one page at a time, with the rating summary. */
  async forProduct(productId: string, q: ReviewQuery = {}): Promise<ProductReviews> {
    const res = await api.get<{ reviews: ApiReview[]; summary: RatingSummary; pagination: Pagination }>(`/products/${encodeURIComponent(productId)}/reviews`, {
      page: q.page ?? 1,
      limit: q.limit ?? REVIEWS_PAGE_SIZE,
      sort: q.sort ?? 'newest',
      rating: q.rating,
    });
    return { reviews: res.reviews.map(toReview), summary: res.summary, pagination: res.pagination };
  },

  /**
   * Submits a review. It goes to moderation before it is published. The API answers 403
   * ("You can review products you have received.") when the customer has not received the product.
   */
  async create(input: ReviewInput): Promise<Review> {
    const review = await api.post<ApiReview>(`/products/${encodeURIComponent(input.productId)}/reviews`, {
      rating: input.rating,
      title: input.title.trim(),
      comment: input.body.trim(),
      fit: input.fit ?? null,
      size: input.size ?? null,
    });
    return toReview(review);
  },

  /** The signed-in customer's own reviews (all moderation statuses). Legacy positional args are ignored. */
  async forUser(_legacyUserId?: string): Promise<Review[]> {
    const rows = await api.get<ApiReview[]>('/reviews/mine');
    return rows.map(toReview);
  },

  /** Edits an own review; it returns to moderation. */
  async update(id: string, input: Partial<Omit<ReviewInput, 'productId'>>): Promise<Review> {
    const review = await api.patch<ApiReview>(`/reviews/${id}`, {
      rating: input.rating,
      title: input.title?.trim(),
      comment: input.body?.trim(),
      fit: input.fit,
      size: input.size,
    });
    return toReview(review);
  },

  /** Deletes an own review. Accepts `remove(id)` (or the legacy `remove(userId, id)`). */
  async remove(idOrLegacyUserId: string, legacyReviewId?: string): Promise<void> {
    await api.delete<void>(`/reviews/${legacyReviewId ?? idOrLegacyUserId}`);
  },
};
