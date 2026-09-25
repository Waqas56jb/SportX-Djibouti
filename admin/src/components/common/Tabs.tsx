import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface TabItem<V extends string> {
  value: V;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}

/** Underline tabs with roving focus (arrow keys). */
export function Tabs<V extends string>({ items, value, onChange, className, ariaLabel }: { items: TabItem<V>[]; value: V; onChange: (v: V) => void; className?: string; ariaLabel?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    let next = idx;
    for (let i = 0; i < items.length; i++) {
      next = (next + dir + items.length) % items.length;
      if (!items[next].disabled) break;
    }
    refs.current[next]?.focus();
    onChange(items[next].value);
  };
  return (
    <div className={cn('-mb-px overflow-x-auto scrollbar-thin', className)}>
      <div role="tablist" aria-label={ariaLabel} className="flex min-w-max gap-5 border-b border-zinc-200">
        {items.map((t, i) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              ref={(el) => (refs.current[i] = el)}
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              disabled={t.disabled}
              onKeyDown={(e) => onKey(e, i)}
              onClick={() => onChange(t.value)}
              className={cn(
                'relative flex items-center gap-2 whitespace-nowrap pb-3 pt-1 text-sm font-medium transition-colors disabled:opacity-40',
                active ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-800',
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold tabular', active ? 'bg-ink-950 text-white' : 'bg-zinc-100 text-zinc-500')}>{t.count}</span>
              )}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ink-950" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Compact pill switcher for ranges and view modes. */
export function Segmented<V extends string>({ options, value, onChange, size = 'sm', className, ariaLabel }: { options: { value: V; label: ReactNode }[]; value: V; onChange: (v: V) => void; size?: 'xs' | 'sm'; className?: string; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex items-center rounded-lg bg-zinc-100 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md font-medium transition-all',
              size === 'xs' ? 'px-2 py-1 text-2xs' : 'px-2.5 py-1 text-xs',
              active ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200/70' : 'text-zinc-500 hover:text-zinc-800',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
