import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
  image?: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => number;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (toast) => {
    const id = ++counter;
    // Keep the stack short — the newest three are enough.
    set((s) => ({ toasts: [...s.toasts.slice(-2), { duration: 4000, ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper usable outside React components. */
export const toast = {
  success: (title: string, extra?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
    useToastStore.getState().push({ variant: 'success', title, ...extra }),
  error: (title: string, extra?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
    useToastStore.getState().push({ variant: 'error', title, ...extra }),
  info: (title: string, extra?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
    useToastStore.getState().push({ variant: 'info', title, ...extra }),
};
