import { AlertOctagon, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { cn } from '@/utils/cn';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

/** Generic skeleton loader for lists of rows/cards. */
export function SkeletonLoader({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label={t('common.ui.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4 border border-paper-200 p-4">
          <Skeleton className="h-20 w-16 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'py-10' : 'py-16 sm:py-24', className)}>
      {icon && (
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-paper-300 text-ink [&>svg]:h-7 [&>svg]:w-7" aria-hidden>
          {icon}
        </div>
      )}
      <h2 className={cn(compact ? 'heading-sm' : 'heading-md')}>{title}</h2>
      {description && <div className="mt-3 max-w-md text-[15px] text-ink-500">{description}</div>}
      {action && <div className="mt-8 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title, message, onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center py-16 text-center', className)}>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger" aria-hidden>
        <AlertOctagon className="h-6 w-6" />
      </div>
      <h2 className="heading-sm">{title ?? t('common.states.error')}</h2>
      <p className="mt-2 max-w-md text-sm text-ink-500">{message ?? t('common.states.errorBody')}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-6" onClick={onRetry} leftIcon={<RotateCcw className="h-4 w-4" />}>
          {t('common.actions.retry')}
        </Button>
      )}
    </div>
  );
}

export function InlineAlert({ tone = 'info', children, className }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode; className?: string }) {
  const tones = {
    info: 'border-ink/10 bg-paper-100 text-ink-700',
    error: 'border-danger/20 bg-danger-50 text-danger',
    success: 'border-success/20 bg-success-50 text-success',
    warning: 'border-warning/20 bg-warning-50 text-warning',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('border px-4 py-3 text-sm', tones[tone], className)}>
      {children}
    </div>
  );
}
