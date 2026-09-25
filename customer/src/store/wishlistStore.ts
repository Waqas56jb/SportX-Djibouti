import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/constants/storage';
import type { WishlistItem } from '@/types';

interface WishlistState {
  items: WishlistItem[];
  /** Returns true when the product was added, false when removed. */
  toggle: (productId: string) => boolean;
  remove: (productId: string) => void;
  replace: (productIds: string[]) => void;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (productId) => {
        const exists = get().items.some((i) => i.productId === productId);
        set((s) => ({
          items: exists
            ? s.items.filter((i) => i.productId !== productId)
            : [{ productId, addedAt: new Date().toISOString() }, ...s.items],
        }));
        return !exists;
      },
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      replace: (productIds) =>
        set((s) => ({
          items: productIds.map(
            (productId) => s.items.find((i) => i.productId === productId) ?? { productId, addedAt: new Date().toISOString() },
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: STORAGE_KEYS.wishlist, version: 1 },
  ),
);
