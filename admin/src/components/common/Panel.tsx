import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Remove body padding (for tables and lists that bleed to the edge). */
  flush?: boolean;
  footer?: ReactNode;
  as?: 'section' | 'div' | 'article';
}

/** The primary surface: white card with a hairline border and optional header/footer. */
export function Panel({ title, description, actions, flush, footer, className, children, as: Tag = 'section', ...rest }: PanelProps) {
  return (
    <Tag className={cn('panel flex flex-col', className)} {...rest}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="panel-title">{title}</h2>}
            {description && <p className="mt-0.5 text-[0.8125rem] text-zinc-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('flex-1', !flush && 'p-5')}>{children}</div>
      {footer && <footer className="border-t border-zinc-100 px-5 py-3">{footer}</footer>}
    </Tag>
  );
}

/** Label/value list used in detail panels. */
export function DescriptionList({ items, columns = 1, className }: { items: { label: ReactNode; value: ReactNode; hidden?: boolean }[]; columns?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', className)}>
      {items
        .filter((i) => !i.hidden)
        .map((i, idx) => (
          <div key={idx} className="min-w-0">
            <dt className="text-xs font-medium text-zinc-500">{i.label}</dt>
            <dd className="mt-1 break-words text-sm text-zinc-900">{i.value ?? '—'}</dd>
          </div>
        ))}
    </dl>
  );
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (!label) return <hr className={cn('border-zinc-100', className)} />;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="h-px flex-1 bg-zinc-100" />
      <span className="eyebrow">{label}</span>
      <span className="h-px flex-1 bg-zinc-100" />
    </div>
  );
}
