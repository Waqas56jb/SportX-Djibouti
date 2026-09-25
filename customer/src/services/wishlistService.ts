import { api } from './api';

export interface WishlistProductSummary {
  id: string;
  name: string;
  slug: string;
  brand: string;
  brandSlug: string;
  image: string | null;
  hoverImage: string | null;
  price: number;
  compareAtPrice: number | null;
  rating: number;
  reviewCount: number;
  badge: string | null;
  isNew: boolean;
  inStock: boolean;
  colors: string[];
}

export interface ServerWishlist {
  ids: string[];
  count: number;
  items: { productId: string; addedAt: string; product: WishlistProductSummary }[];
}

/**
 * Account wishlist (`/wishlist`, signed-in only). Guests keep an on-device list in
 * store/wishlistStore, which is merged into the account list once on sign-in.
 * Every call returns the full, refreshed list.
 */
export const wishlistService = {
  get: () => api.get<ServerWishlist>('/wishlist'),

  add: (productId: string) => api.post<ServerWishlist>(`/wishlist/${encodeURIComponent(productId)}`),

  remove: (productId: string) => api.delete<ServerWishlist>(`/wishlist/${encodeURIComponent(productId)}`),

  /** Union of the guest list and the account list; unknown / unpublished products are skipped. */
  merge: (productIds: string[]) => api.post<ServerWishlist>('/wishlist/merge', { productIds: productIds.filter((id) => /^[A-Za-z0-9-]+$/.test(id)).slice(0, 200) }),
};
