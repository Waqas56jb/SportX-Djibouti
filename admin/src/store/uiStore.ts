import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CurrencyCode } from '@/types';
import { setActiveCurrency } from '@/utils/format';

interface UiState {
  /** Desktop: collapsed icon rail. */
  sidebarCollapsed: boolean;
  /** Mobile/tablet: drawer open. */
  mobileNavOpen: boolean;
  commandOpen: boolean;
  /** Nav groups the user expanded/collapsed manually. */
  openGroups: Record<string, boolean>;
  tableDensity: 'comfortable' | 'compact';
  currency: CurrencyCode;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setGroupOpen: (id: string, open: boolean) => void;
  setDensity: (d: UiState['tableDensity']) => void;
  setCurrency: (c: CurrencyCode) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      commandOpen: false,
      openGroups: {},
      tableDensity: 'comfortable',
      currency: 'DJF',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (open) => set({ mobileNavOpen: open }),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setGroupOpen: (id, open) => set((s) => ({ openGroups: { ...s.openGroups, [id]: open } })),
      setDensity: (tableDensity) => set({ tableDensity }),
      setCurrency: (currency) => {
        setActiveCurrency(currency);
        set({ currency });
      },
    }),
    {
      name: 'sportx-admin-ui',
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, openGroups: s.openGroups, tableDensity: s.tableDensity, currency: s.currency }),
      onRehydrateStorage: () => (state) => {
        if (state) setActiveCurrency(state.currency);
      },
    },
  ),
);
