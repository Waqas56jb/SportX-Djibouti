import { create } from 'zustand';
import type { ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  /** Require typing this text to enable the confirm button (for highly destructive actions). */
  requireText?: string;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((ok: boolean) => void) | null;
  ask: (o: ConfirmOptions) => Promise<boolean>;
  close: (ok: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  ask: (options) =>
    new Promise<boolean>((resolve) => {
      get().resolve?.(false);
      set({ open: true, options, resolve });
    }),
  close: (ok) => {
    get().resolve?.(ok);
    set({ open: false, resolve: null });
  },
}));

/** Promise-based confirmation: `if (await confirm({ title: 'Delete product?' })) { ... }` */
export const confirm = (o: ConfirmOptions) => useConfirmStore.getState().ask(o);
