import { useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useClickOutside } from '@/hooks/misc';
import { Field } from './Field';
import type { SelectOption } from './Inputs';

// ─── Toggle ─────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label, description, disabled, size = 'md', className, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean; size?: 'sm' | 'md'; className?: string; /** Accessible name when no visible label is shown. */ ariaLabel?: string }) {
  const id = useId();
  const sw = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-5 w-9' : 'h-6 w-11',
        checked ? 'bg-ink-950' : 'bg-zinc-300',
      )}
    >
      <span
        className={cn(
          'inline-block transform rounded-full bg-white shadow transition-transform',
          size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
          checked ? (size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]') : 'translate-x-0.5',
        )}
      >
        {checked && <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-volt" />}
      </span>
    </button>
  );
  if (!label) return <span className={className}>{sw}</span>;
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-zinc-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>}
      </label>
      {sw}
    </div>
  );
}

// ─── Checkbox ───────────────────────────────────────────────────────────────
export function Checkbox({ checked, indeterminate, onChange, label, description, disabled, className, ariaLabel }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean; className?: string; ariaLabel?: string }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span className="relative mt-px inline-flex h-4 w-4 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          ref={(el) => {
            if (el) el.indeterminate = Boolean(indeterminate && !checked);
          }}
          onChange={(e) => onChange(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-zinc-300 bg-white shadow-sm transition-colors checked:border-ink-950 checked:bg-ink-950 indeterminate:border-ink-950 indeterminate:bg-ink-950 hover:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Check size={12} strokeWidth={3} className="pointer-events-none absolute left-0.5 top-0.5 hidden text-white peer-checked:block" aria-hidden />
        {indeterminate && !checked && <span className="pointer-events-none absolute left-[3px] top-[7px] h-0.5 w-2.5 rounded bg-white" aria-hidden />}
      </span>
      {label && (
        <label htmlFor={id} className="cursor-pointer select-none">
          <span className="block text-sm text-zinc-800">{label}</span>
          {description && <span className="block text-xs text-zinc-500">{description}</span>}
        </label>
      )}
    </div>
  );
}

// ─── Radio group ────────────────────────────────────────────────────────────
export interface RadioOption<V extends string> {
  value: V;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function RadioGroup<V extends string>({ label, value, onChange, options, variant = 'list', columns = 2, className, error }: { label?: ReactNode; value: V; onChange: (v: V) => void; options: RadioOption<V>[]; variant?: 'list' | 'cards'; columns?: 1 | 2 | 3 | 4; className?: string; error?: string }) {
  const name = useId();
  return (
    <fieldset className={className}>
      {label && <legend className="mb-2 text-[0.8125rem] font-medium text-zinc-800">{label}</legend>}
      <div className={cn(variant === 'cards' ? cn('grid gap-2', columns >= 2 && 'sm:grid-cols-2', columns === 3 && 'lg:grid-cols-3', columns === 4 && 'lg:grid-cols-4') : 'space-y-2')}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                'flex cursor-pointer items-start gap-2.5',
                variant === 'cards' && 'rounded-lg border px-3 py-2.5 transition-colors',
                variant === 'cards' && (active ? 'border-ink-950 bg-zinc-50 ring-1 ring-ink-950' : 'border-zinc-200 hover:border-zinc-300'),
                o.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <input type="radio" name={name} value={o.value} checked={active} disabled={o.disabled} onChange={() => onChange(o.value)} className="peer sr-only" />
              <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-900 peer-focus-visible:ring-offset-2', active ? 'border-ink-950 bg-ink-950' : 'border-zinc-300 bg-white')}>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-zinc-900">{o.label}</span>
                {o.description && <span className="mt-0.5 block text-xs text-zinc-500">{o.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </fieldset>
  );
}

// ─── Multi-select ───────────────────────────────────────────────────────────
export function MultiSelect({ label, help, error, required, optional, options, value, onChange, placeholder = 'Select…', className, searchable = true, maxChips = 4 }: { label?: ReactNode; help?: ReactNode; error?: string; required?: boolean; optional?: boolean; options: SelectOption[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string; className?: string; searchable?: boolean; maxChips?: number }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useClickOutside([box], () => setOpen(false), open);
  const selected = options.filter((o) => value.includes(o.value));
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <Field label={label} help={help} error={error} required={required} optional={optional} className={className}>
      {({ id, describedBy, invalid }) => (
        <div ref={box} className="relative">
          <button
            id={id}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-describedby={describedBy}
            onClick={() => setOpen((o) => !o)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            className={cn(
              'flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border bg-white py-1 pl-2 pr-8 text-left text-sm shadow-sm',
              invalid ? 'border-red-400' : 'border-zinc-200 hover:border-zinc-300',
              open && 'border-zinc-900 ring-2 ring-zinc-900/10',
            )}
          >
            {selected.length === 0 && <span className="px-1 text-zinc-400">{placeholder}</span>}
            {selected.slice(0, maxChips).map((s) => (
              <span key={s.value} className="inline-flex items-center gap-1 rounded-md bg-zinc-100 py-0.5 pl-2 pr-1 text-xs font-medium text-zinc-800">
                {s.label}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${s.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(s.value);
                  }}
                  className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                >
                  <X size={11} aria-hidden />
                </span>
              </span>
            ))}
            {selected.length > maxChips && <span className="text-xs font-medium text-zinc-500">+{selected.length - maxChips} more</span>}
            <ChevronDown size={15} className="absolute right-3 top-2.5 text-zinc-400" aria-hidden />
          </button>
          {open && (
            <div className="absolute z-40 mt-1 w-full animate-scale-in overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-pop">
              {searchable && (
                <div className="border-b border-zinc-100 p-2">
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" aria-label="Filter options" className="h-8 w-full rounded-md bg-zinc-50 px-2.5 text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
                </div>
              )}
              <ul role="listbox" aria-multiselectable className="max-h-60 overflow-y-auto p-1 scrollbar-thin">
                {filtered.length === 0 && <li className="px-3 py-6 text-center text-xs text-zinc-500">No matches</li>}
                {filtered.map((o) => {
                  const on = value.includes(o.value);
                  return (
                    <li key={o.value}>
                      <button type="button" role="option" aria-selected={on} onClick={() => toggle(o.value)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[0.8125rem] text-zinc-800 hover:bg-zinc-100">
                        <span className={cn('flex h-4 w-4 items-center justify-center rounded border', on ? 'border-ink-950 bg-ink-950 text-white' : 'border-zinc-300')}>{on && <Check size={11} strokeWidth={3} />}</span>
                        {o.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {value.length > 0 && (
                <div className="flex justify-between border-t border-zinc-100 px-3 py-2 text-xs">
                  <span className="text-zinc-500">{value.length} selected</span>
                  <button type="button" onClick={() => onChange([])} className="font-medium text-zinc-700 hover:text-zinc-950">
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}

// ─── Color selector ─────────────────────────────────────────────────────────
export function ColorSelector({ label, colors, value, onChange, multiple = false, className }: { label?: ReactNode; colors: { name: string; hex: string }[]; value: string[]; onChange: (v: string[]) => void; multiple?: boolean; className?: string }) {
  return (
    <fieldset className={className}>
      {label && <legend className="mb-2 text-[0.8125rem] font-medium text-zinc-800">{label}</legend>}
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => {
          const on = value.includes(c.name);
          return (
            <button
              key={c.name}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(multiple ? (on ? value.filter((v) => v !== c.name) : [...value, c.name]) : [c.name])}
              className={cn('inline-flex items-center gap-2 rounded-lg border py-1.5 pl-1.5 pr-3 text-[0.8125rem] font-medium transition-colors', on ? 'border-ink-950 bg-ink-950 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300')}
            >
              <span className="h-5 w-5 rounded-md ring-1 ring-inset ring-black/10" style={{ background: c.hex }} aria-hidden />
              {c.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Toggleable chips for picking sizes, tags etc. */
export function ChipSelector({ label, options, value, onChange, className }: { label?: ReactNode; options: string[]; value: string[]; onChange: (v: string[]) => void; className?: string }) {
  return (
    <fieldset className={className}>
      {label && <legend className="mb-2 text-[0.8125rem] font-medium text-zinc-800">{label}</legend>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
              className={cn('min-w-10 rounded-lg border px-2.5 py-1.5 text-[0.8125rem] font-medium tabular transition-colors', on ? 'border-ink-950 bg-ink-950 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300')}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
