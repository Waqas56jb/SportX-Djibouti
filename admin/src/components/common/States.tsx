import type { ReactNode } from 'react';
import { AlertTriangle, RotateCw, type LucideIcon, Inbox } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, secondaryAction, compact, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <div className="relative mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-card">
          <Icon size={22} className="text-zinc-400" strokeWidth={1.75} aria-hidden />
        </div>
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-volt ring-2 ring-white" aria-hidden />
      </div>
      <h3 className="text-[0.9375rem] font-semibold text-zinc-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[0.8125rem] leading-relaxed text-zinc-500">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {secondaryAction}
          {action}
        </div>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

/** Friendly error UI. Never renders stack traces or raw server messages beyond a short sentence. */
export function ErrorState({ title = 'Something went wrong.', description = 'We couldn’t load this data. Check your connection and try again.', onRetry, compact, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-100 bg-red-50">
        <AlertTriangle size={22} className="text-red-600" strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="text-[0.9375rem] font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 max-w-sm text-[0.8125rem] text-zinc-500">{description}</p>
      {onRetry && (
        <Button className="mt-5" variant="secondary" size="sm" icon={RotateCw} onClick={onRetry}>
          TRY AGAIN
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3" style={{ width: `${i === lines - 1 ? 60 : 100 - i * 6}%` }} />
      ))}
    </div>
  );
}

/** Generic panel-shaped skeleton for cards and detail sections. */
export function SkeletonPanel({ className, rows = 4 }: { className?: string; rows?: number }) {
  return (
    <div className={cn('panel p-5', className)} aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-5 h-4 w-40" />
      <SkeletonText lines={rows} />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="mb-8 h-7 w-64" />
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonPanel rows={2} />
        <SkeletonPanel rows={2} />
        <SkeletonPanel rows={2} />
      </div>
      <SkeletonPanel className="mt-4" rows={8} />
    </div>
  );
}
