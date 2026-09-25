import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useDocumentTitle } from '@/hooks/misc';

export interface PageHeaderProps {
  title: ReactNode;
  /** Plain-text title for the browser tab when `title` is a node. */
  documentTitle?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({ title, documentTitle, description, eyebrow, actions, backTo, backLabel = 'Back', meta, className }: PageHeaderProps) {
  useDocumentTitle(documentTitle ?? (typeof title === 'string' ? title : undefined));
  return (
    <div className={cn('mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        {backTo && (
          <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-zinc-500 hover:text-zinc-900">
            <ArrowLeft size={14} aria-hidden /> {backLabel}
          </Link>
        )}
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-[1.625rem] font-semibold leading-tight tracking-tight text-zinc-950 sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-zinc-500">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
    </div>
  );
}
