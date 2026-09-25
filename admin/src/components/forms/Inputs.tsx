import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown, Search, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { getActiveCurrency } from '@/utils/format';
import { Field, controlClass, type FieldProps } from './Field';

type Base = Omit<FieldProps, 'children'>;

// ─── Input ──────────────────────────────────────────────────────────────────
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>, Base {
  icon?: LucideIcon;
  prefix?: ReactNode;
  suffix?: ReactNode;
  inputClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, help, error, required, optional, aside, className, icon: Icon, prefix, suffix, inputClassName, ...rest },
  ref,
) {
  return (
    <Field label={label} help={help} error={error} required={required} optional={optional} aside={aside} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative flex items-center">
          {Icon && <Icon size={16} className="pointer-events-none absolute left-3 text-zinc-400" aria-hidden />}
          {prefix && <span className="pointer-events-none absolute left-3 text-sm font-medium text-zinc-500">{prefix}</span>}
          <input
            ref={ref}
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            className={controlClass(invalid, cn('h-9', (Icon || prefix) && (prefix ? 'pl-12' : 'pl-9'), suffix && 'pr-12', inputClassName))}
            {...rest}
          />
          {suffix && <span className="pointer-events-none absolute right-3 text-sm text-zinc-500">{suffix}</span>}
        </div>
      )}
    </Field>
  );
});

// ─── Number / Currency ──────────────────────────────────────────────────────
export interface NumberInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: number | '' | undefined;
  onValueChange: (v: number | '') => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberInput({ value, onValueChange, min, max, step = 1, ...rest }: NumberInputProps) {
  return (
    <Input
      {...rest}
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onValueChange(e.target.value === '' ? '' : Number(e.target.value))}
      inputClassName={cn('tabular', rest.inputClassName)}
    />
  );
}

/** Money input showing the store currency. Amounts are stored as plain numbers in the store currency. */
export function CurrencyInput(props: Omit<NumberInputProps, 'prefix'>) {
  const currency = getActiveCurrency();
  return <NumberInput min={0} step={currency === 'DJF' ? 100 : 0.01} {...props} prefix={currency} />;
}

// ─── Textarea ───────────────────────────────────────────────────────────────
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, Base {
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, help, error, required, optional, aside, className, showCount, maxLength, value, rows = 4, ...rest },
  ref,
) {
  const count = typeof value === 'string' ? value.length : 0;
  return (
    <Field
      label={label}
      help={help}
      error={error}
      required={required}
      optional={optional}
      className={className}
      aside={aside ?? (showCount && maxLength ? <span className="tabular">{count}/{maxLength}</span> : undefined)}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          value={value}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={controlClass(invalid, 'min-h-[80px] resize-y py-2 leading-relaxed')}
          {...rest}
        />
      )}
    </Field>
  );
});

// ─── Select ─────────────────────────────────────────────────────────────────
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>, Base {
  options: SelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, help, error, required, optional, aside, className, options, placeholder, size = 'md', ...rest },
  ref,
) {
  return (
    <Field label={label} help={help} error={error} required={required} optional={optional} aside={aside} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={controlClass(invalid, cn('appearance-none pr-9', size === 'sm' ? 'h-8 text-[0.8125rem]' : 'h-9'))}
            {...rest}
          >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden />
        </div>
      )}
    </Field>
  );
});

/** Borderless compact select used in filter bars. */
export function FilterSelect({ label, value, onChange, options, allLabel = 'All', className }: { label: string; value: string; onChange: (v: string) => void; options: SelectOption[]; allLabel?: string; className?: string }) {
  const active = Boolean(value);
  return (
    <label className={cn('relative inline-flex h-8 items-center rounded-lg border text-[0.8125rem] shadow-sm transition-colors', active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300', className)}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-full cursor-pointer appearance-none bg-transparent pl-3 pr-8 font-medium focus:outline-none [&>option]:text-zinc-900">
        <option value="">
          {label}: {allLabel}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className={cn('pointer-events-none absolute right-2.5', active ? 'text-zinc-300' : 'text-zinc-400')} aria-hidden />
    </label>
  );
}

// ─── Search ─────────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search…', className, label = 'Search', autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; label?: string; autoFocus?: boolean }) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search size={15} className="pointer-events-none absolute left-3 text-zinc-400" aria-hidden />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-8 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-8 text-[0.8125rem] shadow-sm placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 rounded p-0.5 text-zinc-400 hover:text-zinc-700">
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}

// ─── Date ───────────────────────────────────────────────────────────────────
export interface DateInputProps extends Omit<InputProps, 'type'> {
  withTime?: boolean;
}

/** Native date/datetime picker styled to match. Value is "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm". */
export function DateInput({ withTime, ...rest }: DateInputProps) {
  return <Input type={withTime ? 'datetime-local' : 'date'} {...rest} inputClassName={cn('tabular', rest.inputClassName)} />;
}
