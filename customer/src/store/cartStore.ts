import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MAX_QUANTITY_PER_LINE } from '@/constants/commerce';
import { STORAGE_KEYS } from '@/constants/storage';
import { t } from '@/i18n';
import { errorMessage } from '@/services';
import { ApiError } from '@/services/api';
import { cartService, type ServerCart } from '@/services/cartService';
import { storeService } from '@/services/storeService';
import type { CartIssue, CartItem } from '@/types';
import { useAuthStore } from './authStore';
import { toast } from './toastStore';

export type AddResult = { ok: true; quantity: number } | { ok: false; reason: string };

/**
 * Two modes:
 * - `guest`: the bag lives on this device (`local`, persisted). Prices are display estimates only.
 * - `account`: the signed-in customer's SERVER cart. Every change goes to the API and the response
 *   (lines, issues, totals) replaces local state — money is never computed client-side.
 * On sign-in the guest bag is merged once (`POST /cart/merge`) and then cleared.
 */
export type CartMode = 'guest' | 'account';

interface CartState {
  mode: CartMode;
  /** Guest bag (persisted). */
  local: CartItem[];
  /** Server cart (account mode, memory only). */
  server: ServerCart | null;
  /** Loading the server cart / merging after sign-in. */
  syncing: boolean;
  /** A server mutation is in flight. */
  pending: boolean;
  syncError: string | null;
  /** Issues from the latest server response ("We updated your bag"). */
  issues: CartIssue[];

  add: (item: CartItem) => Promise<AddResult>;
  setQuantity: (id: string, quantity: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Empties the bag (server cart too when signed in). */
  clear: () => Promise<void>;
  /** Clears only the on-device bag (after an order is placed — the API already emptied the server cart). */
  clearLocal: () => void;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  /** Re-fetches the server cart (no-op for guests). */
  refresh: () => Promise<ServerCart | null>;
  dismissIssues: () => void;
  attachAccount: () => Promise<void>;
  detachAccount: () => void;
}

const lineLimit = (item: Pick<CartItem, 'maxStock'>) => Math.min(item.maxStock, storeService.peek()?.maxQuantityPerLine ?? MAX_QUANTITY_PER_LINE);

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      /** Applies a server response; stale responses (older request) are ignored. */
      let version = 0;
      const apply = async (call: () => Promise<ServerCart>, optimistic?: (s: ServerCart) => ServerCart) => {
        const id = ++version;
        const before = get().server;
        if (optimistic && before) set({ server: optimistic(before) });
        set({ pending: true });
        try {
          const next = await call();
          if (id === version) set({ server: next, issues: next.issues, syncError: null });
          return next;
        } catch (err) {
          if (id === version && before) set({ server: before });
          throw err;
        } finally {
          if (id === version) set({ pending: false });
        }
      };

      return {
        mode: 'guest',
        local: [],
        server: null,
        syncing: false,
        pending: false,
        syncError: null,
        issues: [],

        add: async (incoming) => {
          if (get().mode === 'account') {
            const before = get().server?.items.find((i) => i.variantId === incoming.variantId)?.quantity ?? 0;
            try {
              const next = await apply(() => cartService.addItem(incoming.variantId, incoming.quantity));
              const after = next.items.find((i) => i.variantId === incoming.variantId)?.quantity ?? 0;
              if (after <= before) {
                const issue = next.issues.find((i) => i.variantId === incoming.variantId);
                return { ok: false, reason: issue?.message ?? t('cart.errors.maxInBag') };
              }
              return { ok: true, quantity: after - before };
            } catch (err) {
              return { ok: false, reason: errorMessage(err, t('cart.errors.addFailed')) };
            }
          }
          const existing = get().local.find((i) => i.id === incoming.id);
          const limit = lineLimit(incoming);
          const current = existing?.quantity ?? 0;
          if (limit <= 0) return { ok: false, reason: t('cart.errors.outOfStock') };
          if (current >= limit) return { ok: false, reason: t('cart.errors.maxInBagCount', { count: limit }) };
          const quantity = Math.min(current + incoming.quantity, limit);
          set((s) => ({
            local: existing
              ? s.local.map((i) => (i.id === incoming.id ? { ...i, quantity, maxStock: incoming.maxStock, unitPrice: incoming.unitPrice, compareAtPrice: incoming.compareAtPrice } : i))
              : [...s.local, { ...incoming, quantity }],
          }));
          return { ok: true, quantity: quantity - current };
        },

        setQuantity: async (id, quantity) => {
          if (get().mode === 'account') {
            const q = Math.max(1, quantity);
            await apply(
              () => cartService.updateItem(id, q),
              (s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, quantity: q } : i)) }),
            ).catch((err) => toast.error(t('cart.toast.updateFailed'), { description: errorMessage(err) }));
            return;
          }
          set((s) => ({ local: s.local.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.min(quantity, lineLimit(i))) } : i)) }));
        },

        remove: async (id) => {
          if (get().mode === 'account') {
            await apply(
              () => cartService.removeItem(id),
              (s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }),
            ).catch((err) => toast.error(t('cart.toast.removeFailed'), { description: errorMessage(err) }));
            return;
          }
          set((s) => ({ local: s.local.filter((i) => i.id !== id) }));
        },

        clear: async () => {
          set({ local: [], issues: [] });
          if (get().mode === 'account') await apply(() => cartService.clear()).catch(() => undefined);
        },

        clearLocal: () => set({ local: [] }),

        applyCoupon: async (code) => {
          if (get().mode !== 'account') throw new ApiError(t('cart.errors.couponSignIn'), 401, 'AUTH_REQUIRED');
          await apply(() => cartService.applyCoupon(code));
        },

        removeCoupon: async () => {
          if (get().mode !== 'account') return;
          await apply(() => cartService.removeCoupon()).catch((err) => toast.error(t('cart.toast.couponRemoveFailed'), { description: errorMessage(err) }));
        },

        refresh: async () => {
          if (get().mode !== 'account') return null;
          try {
            return await apply(() => cartService.get());
          } catch (err) {
            set({ syncError: errorMessage(err) });
            return null;
          }
        },

        dismissIssues: () => set({ issues: [] }),

        attachAccount: async () => {
          set({ mode: 'account', syncing: true, syncError: null });
          const guest = get().local;
          try {
            const next = guest.length
              ? await cartService.merge(guest.map((i) => ({ variantId: i.variantId, quantity: i.quantity })))
              : await cartService.get();
            if (get().mode !== 'account') return; // signed out meanwhile
            // Merge happened once — the device bag now lives on the account.
            set({ server: next, issues: next.issues, local: [] });
          } catch (err) {
            // Keep the guest bag so nothing is lost; the next attach / refresh retries.
            set({ syncError: errorMessage(err, t('cart.errors.loadFailed')) });
          } finally {
            set({ syncing: false });
          }
        },

        detachAccount: () => {
          version++;
          set({ mode: 'guest', server: null, issues: [], syncing: false, pending: false, syncError: null });
        },
      };
    },
    {
      name: STORAGE_KEYS.cart,
      version: 2,
      // Only the guest bag is persisted; the account cart always comes from the API.
      partialize: (s) => ({ local: s.local }),
      migrate: (persisted, from) => {
        const p = persisted as { items?: CartItem[]; local?: CartItem[] } | undefined;
        return { local: from < 2 ? (p?.items ?? []) : (p?.local ?? []) } as unknown as CartState;
      },
    },
  ),
);

/** Visible lines for the current mode. */
// Stable empty array: a fresh [] per call makes useSyncExternalStore re-render forever.
const NO_ITEMS: CartItem[] = [];
export const selectCartItems = (s: CartState) => (s.mode === 'account' ? (s.server?.items ?? NO_ITEMS) : s.local);
export const selectCartCount = (s: CartState) => selectCartItems(s).reduce((n, i) => n + i.quantity, 0);

// ─── Follow the signed-in user: merge once on sign-in, back to guest on sign-out ───
let attachedUser: string | null = null;
const follow = (userId: string | null) => {
  const store = useCartStore.getState();
  if (!userId) {
    if (attachedUser || store.mode === 'account') store.detachAccount();
    attachedUser = null;
    return;
  }
  if (attachedUser === userId) return;
  attachedUser = userId;
  void store.attachAccount();
};
follow(useAuthStore.getState().session?.user.id ?? null);
useAuthStore.subscribe((s) => follow(s.session?.user.id ?? null));
// Warm the store settings (free-delivery threshold, per-line limit).
void storeService.get().catch(() => undefined);
