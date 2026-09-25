import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MAX_QUANTITY_PER_LINE } from '@/constants/commerce';
import { STORAGE_KEYS } from '@/constants/storage';
import type { CartIssue, CartItem, Coupon } from '@/types';

export type AddResult = { ok: true; quantity: number } | { ok: false; reason: string };

interface CartState {
  items: CartItem[];
  coupon: Coupon | null;
  add: (item: CartItem) => AddResult;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  setCoupon: (coupon: Coupon | null) => void;
  /** Applies server validation results (stock reductions, removals, price changes). */
  reconcile: (issues: CartIssue[]) => void;
}

const lineLimit = (item: Pick<CartItem, 'maxStock'>) => Math.min(item.maxStock, MAX_QUANTITY_PER_LINE);

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,

      add: (incoming) => {
        const existing = get().items.find((i) => i.id === incoming.id);
        const limit = lineLimit(incoming);
        const current = existing?.quantity ?? 0;
        if (limit <= 0) return { ok: false, reason: 'This item is out of stock.' };
        if (current >= limit) {
          return { ok: false, reason: `You already have the maximum available (${limit}) in your bag.` };
        }
        const quantity = Math.min(current + incoming.quantity, limit);
        set((s) => ({
          items: existing
            ? s.items.map((i) => (i.id === incoming.id ? { ...i, quantity, maxStock: incoming.maxStock, unitPrice: incoming.unitPrice } : i))
            : [...s.items, { ...incoming, quantity }],
        }));
        return { ok: true, quantity: quantity - current };
      },

      setQuantity: (id, quantity) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.min(quantity, lineLimit(i))) } : i)),
        })),

      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      clear: () => set({ items: [], coupon: null }),

      setCoupon: (coupon) => set({ coupon }),

      reconcile: (issues) =>
        set((s) => ({
          items: s.items
            .map((item) => {
              const mine = issues.filter((i) => i.itemId === item.id);
              if (mine.some((i) => i.type === 'removed' || i.type === 'out-of-stock')) return null;
              let next = item;
              const reduced = mine.find((i) => i.type === 'stock-reduced');
              if (reduced?.availableStock !== undefined) {
                next = { ...next, maxStock: reduced.availableStock, quantity: Math.min(next.quantity, reduced.availableStock) };
              }
              const priced = mine.find((i) => i.type === 'price-changed');
              if (priced?.newPrice !== undefined) next = { ...next, unitPrice: priced.newPrice };
              return next;
            })
            .filter((i): i is CartItem => i !== null),
        })),
    }),
    { name: STORAGE_KEYS.cart, version: 1 },
  ),
);

export const selectCartCount = (s: CartState) => s.items.reduce((n, i) => n + i.quantity, 0);

