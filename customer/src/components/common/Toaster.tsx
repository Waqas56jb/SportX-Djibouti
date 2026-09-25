import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToastStore, type Toast } from '@/store/toastStore';
import { t } from '@/i18n';
import { cn } from '@/utils/cn';

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />,
  error: <AlertCircle className="h-5 w-5 text-danger" aria-hidden />,
  info: <Info className="h-5 w-5 text-ink-500" aria-hidden />,
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [paused, toast.id, toast.duration, dismiss]);

  return (
    <li
      className="pointer-events-auto relative flex w-full animate-toast-in items-start gap-3 overflow-hidden border border-paper-200 bg-white p-4 shadow-lift"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role={toast.variant === 'error' ? 'alert' : 'status'}
    >
      {toast.image ? (
        <img src={`${toast.image}&w=120`} alt="" className="h-14 w-12 shrink-0 bg-paper-100 object-cover" />
      ) : (
        <span className="mt-0.5 shrink-0">{ICONS[toast.variant]}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{toast.title}</p>
        {toast.description && <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{toast.description}</p>}
        {toast.action && (
          <button
            type="button"
            className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink underline underline-offset-4 hover:text-accent-dark"
            onClick={() => {
              toast.action?.onClick();
              dismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button type="button" onClick={() => dismiss(toast.id)} className="-m-1 p-1 text-ink-500 hover:text-ink" aria-label={t('common.ui.dismissNotification')}>
        <X className="h-4 w-4" />
      </button>
      <span
        className={cn('absolute bottom-0 start-0 h-[2px] w-full origin-left bg-ink/80 rtl:origin-right', paused && '[animation-play-state:paused]')}
        style={{ animation: `progress ${toast.duration}ms linear forwards` }}
        aria-hidden
      />
    </li>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return createPortal(
    <ol
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:bottom-6 sm:start-auto sm:end-6 sm:w-[380px] sm:items-end sm:p-0"
    >
      {toasts.map((item) => (
        <ToastItem key={item.id} toast={item} />
      ))}
    </ol>,
    document.body,
  );
}
