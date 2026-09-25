export interface Review {
  id: string;
  productId: string;
  userId: string | null;
  author: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  verified: boolean;
  size?: string;
  fit?: 'small' | 'true' | 'large';
}

export interface ReviewInput {
  productId: string;
  rating: number;
  title: string;
  body: string;
  fit?: Review['fit'];
}

export interface RatingSummary {
  average: number;
  total: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}
