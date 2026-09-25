import { Minus, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  size?: 'sm' | 'md';
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function QuantitySelector({ value, onChange, min = 1, max, size = 'md', disabled, label = 'Quantity', className }: QuantitySelectorProps) {
  const h = size === 'sm' ? 'h-10' : 'h-12';
  const w = size === 'sm' ? 'w-9' : 'w-11';
  return (
    <div className={cn('inline-flex items-stretch border border-paper-300 bg-white', h, disabled && 'opacity-50', className)} role="group" aria-label={label}>
      <button
        type="button"
        className={cn('flex items-center justify-center text-ink transition-colors hover:bg-paper-100 disabled:cursor-not-allowed disabled:text-ink-500/40', w)}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <output className={cn('flex min-w-[2.5rem] items-center justify-center text-sm font-semibold tabular-nums', size === 'sm' && 'min-w-[2rem]')} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={cn('flex items-center justify-center text-ink transition-colors hover:bg-paper-100 disabled:cursor-not-allowed disabled:text-ink-500/40', w)}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
