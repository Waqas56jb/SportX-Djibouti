import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/common/Button';
import { useConfirmStore } from '@/store/confirmStore';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Focus trap + Escape + scroll lock shared by Modal and Drawer. */
function useDialogBehaviour(open: boolean, onClose: () => void, panel: React.RefObject<HTMLDivElement>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const el = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      (el ?? panel.current)?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab' && panel.current) {
        const els = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, panel]);
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Prevent closing via backdrop (e.g. while saving). */
  dismissible?: boolean;
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = () => dismissible && onClose();
  useDialogBehaviour(open, close, panel);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-[2px]" onClick={close} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('relative flex max-h-[92vh] w-full animate-scale-in flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl', SIZES[size])}
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold tracking-tight text-zinc-950">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-[0.8125rem] text-zinc-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800">
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin sm:px-6">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-3 sm:rounded-b-2xl sm:px-6">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export interface DrawerProps extends Omit<ModalProps, 'size'> {
  width?: 'md' | 'lg' | 'xl';
  headerExtra?: ReactNode;
}

const WIDTHS = { md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl' };

/** Right-side panel for contextual editing and detail views. */
export function Drawer({ open, onClose, title, description, children, footer, width = 'lg', dismissible = true, headerExtra }: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = () => dismissible && onClose();
  useDialogBehaviour(open, close, panel);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/40 backdrop-blur-[1px]" onClick={close} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={cn('relative flex h-full w-full animate-slide-in-right flex-col bg-white shadow-pop', WIDTHS[width])}>
        <header className="border-b border-zinc-100 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold tracking-tight text-zinc-950">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-[0.8125rem] text-zinc-500">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close panel" className="-mr-1.5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800">
              <X size={18} aria-hidden />
            </button>
          </div>
          {headerExtra}
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin sm:px-6">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-3 sm:px-6">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** Global host for `confirm()` — mounted once in the app shell. */
export function ConfirmHost() {
  const { open, options, close } = useConfirmStore();
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);
  if (!options) return null;
  const danger = options.tone !== 'default';
  const blocked = Boolean(options.requireText && typed !== options.requireText);
  return (
    <Modal
      open={open}
      onClose={() => close(false)}
      size="sm"
      title={
        <span className="flex items-center gap-2.5">
          {danger && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle size={15} className="text-red-600" aria-hidden />
            </span>
          )}
          {options.title}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)} data-autofocus>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => close(true)}>
            {options.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-zinc-600">{options.description ?? 'This action cannot be undone.'}</div>
      {options.requireText && (
        <label className="mt-4 block">
          <span className="text-xs text-zinc-500">
            Type <strong className="font-mono text-zinc-900">{options.requireText}</strong> to confirm
          </span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-zinc-200 px-3 font-mono text-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
        </label>
      )}
    </Modal>
  );
}

/** Full-screen image viewer with keyboard navigation. */
export function ImagePreview({ images, index, onClose, onIndexChange }: { images: { url: string; alt: string }[]; index: number | null; onClose: () => void; onIndexChange: (i: number) => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const open = index !== null;
  useDialogBehaviour(open, onClose, panel);
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onIndexChange(((index ?? 0) + 1) % images.length);
      if (e.key === 'ArrowLeft') onIndexChange(((index ?? 0) - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open, index, images.length, onIndexChange]);
  if (index === null || !images[index]) return null;
  const img = images[index];
  return createPortal(
    <div ref={panel} role="dialog" aria-modal="true" aria-label="Image preview" tabIndex={-1} className="fixed inset-0 z-[80] flex animate-fade-in items-center justify-center bg-ink-950/90 p-6">
      <button type="button" onClick={onClose} aria-label="Close preview" className="absolute right-4 top-4 rounded-lg p-2 text-zinc-300 hover:bg-white/10 hover:text-white">
        <X size={22} />
      </button>
      {images.length > 1 && (
        <>
          <button type="button" aria-label="Previous image" onClick={() => onIndexChange((index - 1 + images.length) % images.length)} className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <ChevronLeft size={22} />
          </button>
          <button type="button" aria-label="Next image" onClick={() => onIndexChange((index + 1) % images.length)} className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <ChevronRight size={22} />
          </button>
        </>
      )}
      <figure className="flex max-h-full flex-col items-center">
        <img src={img.url} alt={img.alt} className="max-h-[80vh] max-w-full rounded-xl bg-white object-contain" />
        <figcaption className="mt-3 text-sm text-zinc-400">
          {img.alt} · {index + 1} / {images.length}
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}
