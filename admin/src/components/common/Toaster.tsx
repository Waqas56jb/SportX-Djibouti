import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type Toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

const ICONS = {
  success: { Icon: CheckCircle2, cls: 'text-emerald-500' },
  error: { Icon: AlertCircle, cls: 'text-red-500' },
  warning: { Icon: AlertTriangle, cls: 'text-amber-500' },
  info: { Icon: Info, cls: 'text-sky-500' },
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, dismiss]);
  const { Icon, cls } = ICONS[t.type];
  return (
    <div role={t.type === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full animate-toast-in items-start gap-3 rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-white shadow-pop sm:w-[360px]">
      <Icon size={18} className={cn('mt-px shrink-0', cls)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t.title}</p>
        {t.description && <p className="mt-0.5 text-xs text-zinc-400">{t.description}</p>}
        {t.action && (
          <button
            type="button"
            onClick={() => {
              t.action!.onClick();
              dismiss(t.id);
            }}
            className="mt-2 text-xs font-semibold text-volt hover:underline"
          >
            {t.action.label}
          </button>
        )}
      </div>
      <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="rounded p-0.5 text-zinc-500 hover:text-white">
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return createPortal(
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-3 z-[90] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>,
    document.body,
  );
}
