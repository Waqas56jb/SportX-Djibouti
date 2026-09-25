import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEscape, useFocusTrap, useLockBodyScroll } from '@/hooks/useUi';
import { t } from '@/i18n';
import { cn } from '@/utils/cn';

/** Keeps content mounted during the exit animation. */
function usePresence(open: boolean, duration = 280) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(timer);
  }, [open, duration]);
  return { mounted, visible };
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Visually hide the title (still announced to screen readers). */
  hideTitle?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const MODAL_SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const;

/** Accessible modal dialog. Becomes a bottom sheet on small screens. */
export function Modal({ open, onClose, title, hideTitle, children, footer, size = 'md', className }: ModalProps) {
  const { mounted, visible } = usePresence(open);
  const panel = useRef<HTMLDivElement>(null);
  useLockBodyScroll(open);
  useEscape(open, onClose);
  useFocusTrap(panel, open && mounted);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className={cn('absolute inset-0 bg-ink/60 backdrop-blur-[2px] transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col bg-white shadow-lift outline-none transition-all duration-300 ease-premium sm:max-h-[88vh]',
          MODAL_SIZES[size],
          visible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-8 opacity-0 sm:translate-y-3 sm:scale-[0.98]',
          className,
        )}
      >
        <div className={cn('flex items-center justify-between gap-4 border-b border-paper-200 px-5 py-4 sm:px-6', hideTitle && 'absolute end-0 top-0 z-10 border-0 bg-transparent')}>
          {title && <h2 className={cn('heading-sm', hideTitle && 'sr-only')}>{title}</h2>}
          <button type="button" onClick={onClose} className="icon-btn -me-2 bg-white/80" aria-label={t('common.ui.closeDialog')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="border-t border-paper-200 px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  title: string;
  hideHeader?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  headerExtra?: ReactNode;
}

/** Side panel used for the cart, mobile menu and mobile filters. */
export function Drawer({ open, onClose, side = 'right', title, hideHeader, children, footer, className, headerExtra }: DrawerProps) {
  const { mounted, visible } = usePresence(open, 420);
  const panel = useRef<HTMLDivElement>(null);
  useLockBodyScroll(open);
  useEscape(open, onClose);
  useFocusTrap(panel, open && mounted);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div
        className={cn('absolute inset-0 bg-ink/50 backdrop-blur-[2px] transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 flex w-full max-w-[440px] flex-col bg-white outline-none transition-transform duration-[420ms] ease-premium',
          // `side` is the reading-direction edge: in RTL "right" (end) panels open from the left.
          side === 'right' ? 'end-0 shadow-drawer' : 'start-0 shadow-lift',
          visible ? 'translate-x-0' : side === 'right' ? 'translate-x-full rtl:-translate-x-full' : '-translate-x-full rtl:translate-x-full',
          className,
        )}
      >
        {!hideHeader && (
          <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-paper-200 px-5">
            <div className="flex items-center gap-3">
              <h2 className="heading-sm">{title}</h2>
              {headerExtra}
            </div>
            <button type="button" onClick={onClose} className="icon-btn -me-2" aria-label={t('common.ui.closeNamed', { name: title })}>
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="safe-bottom shrink-0 border-t border-paper-200 bg-white">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
