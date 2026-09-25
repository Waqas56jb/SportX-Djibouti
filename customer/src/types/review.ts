export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN' | (string & {});

export interface Review {
  id: string;
  productId: string;
  userId?: string | null;
  author: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  verified: boolean;
  size?: string;
  fit?: 'small' | 'true' | 'large';
  helpfulCount?: number;
  /** Moderation status — only present on the author's own reviews. */
  status?: ReviewStatus;
  product?: { id: string; name: string; slug: string | null; image: string | null };
}

export interface ReviewInput {
  productId: string;
  rating: number;
  title: string;
  body: string;
  fit?: Review['fit'];
  size?: string;
}

export interface RatingSummary {
  average: number;
  total: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export type ReviewSort = 'newest' | 'highest' | 'lowest' | 'helpful';
