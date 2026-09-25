import { PRODUCTS } from '@/data/products';
import { generateProductReviews } from '@/data/reviews';
import type { RatingSummary, Review, ReviewInput, User } from '@/types';
import { uid } from '@/utils/id';
import { apiClient } from './api/client';
import { USE_MOCK_API } from './config';
import { MockError, db, delay } from './mock/db';

export interface ProductReviews {
  reviews: Review[];
  summary: RatingSummary;
}

/** Spreads the product's aggregate rating into a plausible 1–5 distribution. */
function summarise(average: number, total: number): RatingSummary {
  const weights = [5, 4, 3, 2, 1].map((star) => Math.exp(-Math.abs(star - average) * 1.6));
  const sum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.round((w / sum) * total));
  return {
    average,
    total,
    distribution: { 5: counts[0], 4: counts[1], 3: counts[2], 2: counts[3], 1: counts[4] },
  };
}

export const reviewService = {
  async forProduct(productId: string): Promise<ProductReviews> {
    if (!USE_MOCK_API) return apiClient.get<ProductReviews>(`/products/${productId}/reviews`);
    await delay(300, 600);
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return { reviews: [], summary: summarise(0, 0) };
    const own = db.read().reviews.filter((r) => r.productId === productId);
    const reviews = [...own, ...generateProductReviews(product)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { reviews, summary: summarise(product.rating, product.reviewCount + own.length) };
  },

  async forUser(userId: string): Promise<Review[]> {
    if (!USE_MOCK_API) return apiClient.get<Review[]>('/me/reviews');
    await delay(300, 500);
    return db
      .read()
      .reviews.filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create(user: User, input: ReviewInput): Promise<Review> {
    if (!USE_MOCK_API) return apiClient.post<Review>(`/products/${input.productId}/reviews`, input);
    await delay(500, 800);
    if (db.read().reviews.some((r) => r.userId === user.id && r.productId === input.productId)) {
      throw new MockError('You have already reviewed this product.', 409);
    }
    const verified = db
      .read()
      .orders.some((o) => o.userId === user.id && o.status === 'delivered' && o.items.some((i) => i.productId === input.productId));
    const review: Review = {
      id: uid('rev'),
      productId: input.productId,
      userId: user.id,
      author: `${user.firstName} ${user.lastName.charAt(0)}.`,
      rating: input.rating,
      title: input.title.trim(),
      body: input.body.trim(),
      fit: input.fit,
      createdAt: new Date().toISOString(),
      verified,
    };
    db.write((d) => {
      d.reviews.unshift(review);
    });
    return review;
  },

  async remove(userId: string, reviewId: string): Promise<void> {
    if (!USE_MOCK_API) return apiClient.delete<void>(`/me/reviews/${reviewId}`);
    await delay(300, 500);
    db.write((d) => {
      d.reviews = d.reviews.filter((r) => !(r.id === reviewId && r.userId === userId));
    });
  },
};
