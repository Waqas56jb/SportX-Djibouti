import { useId, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface FieldProps {
  label?: ReactNode;
  help?: ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  /** Right side of label row (e.g. character counter, "Generate" link). */
  aside?: ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Label + control + help/error, wiring ids and aria attributes for accessibility. */
export function Field({ label, help, error, required, optional, className, aside, children }: FieldProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, helpId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('min-w-0', className)}>
      {(label || aside) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          {label && (
            <label htmlFor={id} className="text-[0.8125rem] font-medium text-zinc-800">
              {label}
              {required && (
                <span className="ml-0.5 text-red-600" aria-hidden>
                  *
                </span>
              )}
              {optional && <span className="ml-1.5 text-xs font-normal text-zinc-400">Optional</span>}
            </label>
          )}
          {aside && <div className="text-xs text-zinc-500">{aside}</div>}
        </div>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errId} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600" role="alert">
          <AlertCircle size={12} aria-hidden /> {error}
        </p>
      ) : help ? (
        <p id={helpId} className="mt-1.5 text-xs text-zinc-500">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export const controlClass = (invalid?: boolean, extra?: string) =>
  cn(
    'block w-full rounded-lg border bg-white px-3 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400',
    'focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500',
    invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15' : 'border-zinc-200 hover:border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10',
    extra,
  );

/** Groups related fields under a heading, used for multi-section forms. */
export function FormSection({ id, title, description, children, actions, className }: { id?: string; title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('panel scroll-mt-24', className)} aria-labelledby={id ? `${id}-title` : undefined}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="panel-title">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[0.8125rem] text-zinc-500">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function FormGrid({ cols = 2, children, className }: { cols?: 1 | 2 | 3 | 4; children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4', cols >= 2 && 'sm:grid-cols-2', cols === 3 && 'lg:grid-cols-3', cols === 4 && 'lg:grid-cols-4', className)}>{children}</div>;
}
