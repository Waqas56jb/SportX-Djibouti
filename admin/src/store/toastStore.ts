import { create } from 'zustand';
import { uid } from '@/utils/id';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid('t');
    set((s) => ({ toasts: [...s.toasts.slice(-3), { duration: t.type === 'error' ? 6000 : 4000, ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

type Opts = Partial<Pick<Toast, 'description' | 'action' | 'duration'>>;
const push = (type: ToastType) => (title: string, opts: Opts = {}) => useToastStore.getState().push({ type, title, ...opts });

/** Imperative toast API usable anywhere: `toast.success('Product created successfully.')`. */
export const toast = {
  success: push('success'),
  error: push('error'),
  warning: push('warning'),
  info: push('info'),
};
