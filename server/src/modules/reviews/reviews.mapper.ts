import { iso } from '../account/schema-helpers.js';

export interface ReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string | null;
  rating: number;
  title: string;
  comment: string;
  fit: 'small' | 'true' | 'large' | null;
  size: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
  verified_purchase: boolean;
  helpful_count: number;
  moderated_by: string | null;
  moderated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // joined
  first_name?: string;
  last_name?: string;
  email?: string;
  product_name?: string;
  product_slug?: string;
  product_type?: string;
  product_image?: string | null;
  order_number?: string | null;
  moderator_name?: string | null;
}

/** "Hodan A." — never the full surname or the email. */
export const authorName = (first?: string, last?: string) => `${(first ?? '').trim() || 'Customer'}${last?.trim() ? ` ${last.trim().charAt(0).toUpperCase()}.` : ''}`;

/** Public storefront view. */
export function toPublicReview(r: ReviewRow) {
  return {
    id: r.id,
    productId: r.product_id,
    author: authorName(r.first_name, r.last_name),
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    body: r.comment,
    fit: r.fit,
    size: r.size,
    verifiedPurchase: r.verified_purchase,
    verified: r.verified_purchase,
    helpfulCount: r.helpful_count,
    createdAt: iso(r.created_at)!,
  };
}

/** The author's own view (includes moderation status). */
export function toOwnReview(r: ReviewRow) {
  return {
    ...toPublicReview(r),
    status: r.status,
    product: r.product_name ? { id: r.product_id, name: r.product_name, slug: r.product_slug ?? null, image: r.product_image ?? null } : undefined,
    updatedAt: iso(r.updated_at)!,
  };
}

export function toAdminReview(r: ReviewRow) {
  return {
    id: r.id,
    productId: r.product_id,
    productName: r.product_name ?? null,
    productSlug: r.product_slug ?? null,
    productType: r.product_type ?? null,
    productImage: r.product_image ?? null,
    customerId: r.user_id,
    customerName: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
    customerEmail: r.email ?? null,
    orderId: r.order_id,
    orderNumber: r.order_number ?? null,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    body: r.comment,
    fit: r.fit,
    size: r.size,
    status: r.status,
    verifiedPurchase: r.verified_purchase,
    helpfulCount: r.helpful_count,
    moderatedAt: iso(r.moderated_at),
    moderatedBy: r.moderator_name ?? null,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}
