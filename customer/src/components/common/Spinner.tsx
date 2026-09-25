import { SITE } from '@/constants/site';
import { t } from '@/i18n';
import { cn } from '@/utils/cn';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center">
      <svg className={cn('h-5 w-5 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-ink shadow-lift" aria-hidden>
          <img src={SITE.logoMark} alt="" className="h-9 w-auto" />
        </span>
        <span className="relative block h-[2px] w-24 overflow-hidden bg-paper-200">
          <span className="absolute inset-y-0 start-0 w-1/3 animate-[shimmer_1.1s_ease-in-out_infinite] bg-ink" style={{ transform: 'translateX(-100%)' }} />
        </span>
        <span className="sr-only">{t('common.ui.loading')}</span>
      </div>
    </div>
  );
}
