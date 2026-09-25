import { apiClient } from './api/client';
import { USE_MOCK_API } from './config';
import { db, delay } from './mock/db';

/**
 * Account-level wishlist persistence. Guests keep their wishlist on-device
 * (see store/wishlistStore); on sign-in the two lists are merged via `sync`.
 */
export const wishlistService = {
  async get(userId: string): Promise<string[]> {
    if (!USE_MOCK_API) return apiClient.get<string[]>('/me/wishlist');
    await delay(150, 300);
    return db.read().wishlists[userId] ?? [];
  },

  async sync(userId: string, productIds: string[]): Promise<string[]> {
    if (!USE_MOCK_API) return apiClient.put<string[]>('/me/wishlist', { productIds });
    await delay(100, 250);
    const merged = [...new Set([...productIds, ...(db.read().wishlists[userId] ?? [])])];
    db.write((d) => {
      d.wishlists[userId] = merged;
    });
    return merged;
  },

  async save(userId: string, productIds: string[]): Promise<void> {
    if (!USE_MOCK_API) return apiClient.put<void>('/me/wishlist', { productIds });
    db.write((d) => {
      d.wishlists[userId] = productIds;
    });
  },
};
