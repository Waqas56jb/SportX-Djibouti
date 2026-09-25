import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

/** Button styled for the dark bulk-action bar. */
export function BulkButton({ icon: Icon, children, danger, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors hover:bg-white/10 disabled:opacity-40', danger && '!text-red-300 hover:!bg-red-500/15', className)}
      {...rest}
    >
      {Icon && <Icon size={13} aria-hidden />}
      {children}
    </button>
  );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

export function ClearFiltersButton({ count, onClear }: { count: number; onClear: () => void }) {
  if (!count) return null;
  return (
    <button type="button" onClick={onClear} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[0.8125rem] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
      <X size={13} aria-hidden /> Clear {count > 1 ? `${count} filters` : 'filter'}
    </button>
  );
}
