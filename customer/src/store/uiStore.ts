import { create } from 'zustand';

type Overlay = 'cart' | 'search' | 'menu' | null;

interface UiState {
  overlay: Overlay;
  quickViewSlug: string | null;
  open: (overlay: Exclude<Overlay, null>) => void;
  close: () => void;
  openQuickView: (slug: string) => void;
  closeQuickView: () => void;
}

/** Global overlays — only one drawer/overlay is open at a time. */
export const useUiStore = create<UiState>()((set) => ({
  overlay: null,
  quickViewSlug: null,
  open: (overlay) => set({ overlay, quickViewSlug: null }),
  close: () => set({ overlay: null }),
  openQuickView: (slug) => set({ quickViewSlug: slug, overlay: null }),
  closeQuickView: () => set({ quickViewSlug: null }),
}));
