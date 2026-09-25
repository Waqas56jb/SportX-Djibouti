import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/constants/storage';

const MAX_RECENT_PRODUCTS = 12;
const MAX_RECENT_SEARCHES = 6;

interface RecentlyViewedState {
  slugs: string[];
  add: (slug: string) => void;
  clear: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      slugs: [],
      add: (slug) => set((s) => ({ slugs: [slug, ...s.slugs.filter((x) => x !== slug)].slice(0, MAX_RECENT_PRODUCTS) })),
      clear: () => set({ slugs: [] }),
    }),
    { name: STORAGE_KEYS.recentlyViewed },
  ),
);

interface SearchHistoryState {
  terms: string[];
  add: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      terms: [],
      add: (term) => {
        const t = term.trim();
        if (!t) return;
        set((s) => ({ terms: [t, ...s.terms.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT_SEARCHES) }));
      },
      remove: (term) => set((s) => ({ terms: s.terms.filter((x) => x !== term) })),
      clear: () => set({ terms: [] }),
    }),
    { name: STORAGE_KEYS.searchHistory },
  ),
);
