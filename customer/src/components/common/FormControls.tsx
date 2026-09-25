import { AlertCircle, Check, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface FieldShellProps {
  id: string;
  label?: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

function FieldShell({ id, label, error, hint, optional, className, children }: FieldShellProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {optional && <span className="ml-1 font-normal normal-case tracking-normal text-ink-500">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: ReactNode) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  containerClassName?: string;
  rightSlot?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, optional, containerClassName, className, id: idProp, rightSlot, type, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';

  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional} className={containerClassName}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn('input', error && 'input-error', (isPassword || rightSlot) && 'pr-12', className)}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-500 hover:text-ink"
            aria-label={reveal ? 'Hide password' : 'Show password'}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : (
          rightSlot && <div className="absolute inset-y-0 right-0 flex items-center pr-3">{rightSlot}</div>
        )}
      </div>
    </FieldShell>
  );
});

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  containerClassName?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, optional, containerClassName, className, id: idProp, options, placeholder, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional} className={containerClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn('input cursor-pointer appearance-none pr-10', error && 'input-error', className)}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
      </div>
    </FieldShell>
  );
});

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  containerClassName?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, hint, optional, containerClassName, className, id: idProp, rows = 5, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional} className={containerClassName}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn('input min-h-[120px] resize-y py-3 leading-relaxed', error && 'input-error', className)}
        {...rest}
      />
    </FieldShell>
  );
});

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

export function Checkbox({ label, description, className, id: idProp, ...rest }: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <label htmlFor={id} className={cn('group flex cursor-pointer items-start gap-3', rest.disabled && 'cursor-not-allowed opacity-50', className)}>
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <input id={id} type="checkbox" className="peer absolute inset-0 cursor-pointer appearance-none rounded-xs border border-ink-500/60 bg-white transition-colors checked:border-ink checked:bg-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2" {...rest} />
        <Check className="pointer-events-none relative h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100" strokeWidth={3} aria-hidden />
      </span>
      <span className="text-sm leading-snug">
        <span className="text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
      </span>
    </label>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

export function Switch({ checked, onChange, label, description }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <p id={`${id}-label`} className="text-sm font-semibold text-ink">
          {label}
        </p>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-ink' : 'bg-paper-300')}
      >
        <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-premium', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}
