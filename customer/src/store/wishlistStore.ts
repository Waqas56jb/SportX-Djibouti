import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/constants/storage';
import { friendlyError } from '@/services/authService';
import { wishlistService, type ServerWishlist } from '@/services/wishlistService';
import type { WishlistItem } from '@/types';
import { toast } from './toastStore';

/**
 * - `guest`: the list lives on this device (persisted to localStorage).
 * - `account`: the list mirrors the signed-in customer's server wishlist; every change is sent to
 *   the API optimistically and rolled back if it fails. Nothing is persisted in this mode.
 */
type WishlistMode = 'guest' | 'account';

interface WishlistState {
  items: WishlistItem[];
  mode: WishlistMode;
  /** True while the account list is being loaded / merged after sign-in. */
  syncing: boolean;
  /** Returns true when the product was added, false when removed. */
  toggle: (productId: string) => boolean;
  remove: (productId: string) => void;
  /** Replaces the whole list locally (guest mode). */
  replace: (productIds: string[]) => void;
  clear: () => void;
  /** Sign-in: merges the on-device list into the account and switches to account mode. */
  attachAccount: () => Promise<void>;
  /** Sign-out: drops the account list and returns to an empty guest list. */
  detachAccount: () => void;
}

const fromServer = (w: ServerWishlist): WishlistItem[] => w.items.map((i) => ({ productId: i.productId, addedAt: i.addedAt }));

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => {
      /** Optimistic server write with rollback. Stale responses are ignored. */
      let version = 0;
      const push = (previous: WishlistItem[], call: () => Promise<ServerWishlist>) => {
        if (get().mode !== 'account') return;
        const v = ++version;
        call()
          .then((w) => {
            if (v === version && get().mode === 'account') set({ items: fromServer(w) });
          })
          .catch((err) => {
            if (v !== version || get().mode !== 'account') return;
            set({ items: previous });
            toast.error('Could not update your wishlist', { description: friendlyError(err) });
          });
      };

      return {
        items: [],
        mode: 'guest',
        syncing: false,

        toggle: (productId) => {
          const previous = get().items;
          const exists = previous.some((i) => i.productId === productId);
          set({
            items: exists ? previous.filter((i) => i.productId !== productId) : [{ productId, addedAt: new Date().toISOString() }, ...previous],
          });
          push(previous, () => (exists ? wishlistService.remove(productId) : wishlistService.add(productId)));
          return !exists;
        },

        remove: (productId) => {
          const previous = get().items;
          if (!previous.some((i) => i.productId === productId)) return;
          set({ items: previous.filter((i) => i.productId !== productId) });
          push(previous, () => wishlistService.remove(productId));
        },

        replace: (productIds) =>
          set((s) => ({
            items: productIds.map((productId) => s.items.find((i) => i.productId === productId) ?? { productId, addedAt: new Date().toISOString() }),
          })),

        clear: () => set({ items: [] }),

        attachAccount: async () => {
          const guestIds = get().mode === 'guest' ? get().items.map((i) => i.productId) : [];
          set({ syncing: true });
          try {
            const w = guestIds.length ? await wishlistService.merge(guestIds) : await wishlistService.get();
            version++;
            set({ items: fromServer(w), mode: 'account' });
          } catch {
            // Keep the on-device list; the next sign-in (or reload) retries the merge.
          } finally {
            set({ syncing: false });
          }
        },

        detachAccount: () => {
          version++;
          set({ items: [], mode: 'guest', syncing: false });
        },
      };
    },
    {
      name: STORAGE_KEYS.wishlist,
      version: 2,
      // Only the guest list is stored on the device; account wishlists live on the server.
      partialize: (s) => ({ items: s.mode === 'guest' ? s.items : [] }),
      migrate: (persisted) => ({ items: (persisted as { items?: WishlistItem[] } | undefined)?.items ?? [] }) as WishlistState,
    },
  ),
);
