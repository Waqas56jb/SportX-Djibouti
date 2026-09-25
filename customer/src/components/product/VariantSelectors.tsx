import { AlertCircle, Ruler } from 'lucide-react';
import type { Product } from '@/types';
import { cn } from '@/utils/cn';
import { isSizeAvailable, stockFor } from '@/utils/product';
import { LOW_STOCK_THRESHOLD } from '@/constants/commerce';

interface ColorSelectorProps {
  product: Product;
  value?: string;
  onChange: (name: string) => void;
  error?: boolean;
}

export function ColorSelector({ product, value, onChange, error }: ColorSelectorProps) {
  if (product.colors.length === 0) return null;
  return (
    <fieldset>
      <legend className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-700">
        Colour <span className="font-normal normal-case tracking-normal text-ink-500">— {value ?? 'Select'}</span>
      </legend>
      <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Colour">
        {product.colors.map((c) => {
          const out = stockFor(product, c.name) === 0;
          const selected = value === c.name;
          return (
            <button
              key={c.name}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${c.name}${out ? ' (sold out)' : ''}`}
              onClick={() => onChange(c.name)}
              className={cn(
                'relative h-11 w-11 rounded-full border-2 p-[3px] transition-all duration-200',
                selected ? 'border-ink' : 'border-transparent hover:border-ink/30',
                error && !value && 'border-danger/50',
              )}
            >
              <span className="block h-full w-full rounded-full border border-ink/10" style={{ backgroundColor: c.hex }} />
              {out && <span className="absolute left-1/2 top-1/2 h-[2px] w-9 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-ink/50" aria-hidden />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface SizeSelectorProps {
  product: Product;
  color?: string;
  value?: string;
  onChange: (size: string) => void;
  error?: boolean;
  onOpenGuide?: () => void;
}

export function SizeSelector({ product, color, value, onChange, error, onOpenGuide }: SizeSelectorProps) {
  if (product.sizes.length <= 1) return null;
  const wide = product.sizes.some((s) => s.length > 5);
  return (
    <fieldset>
      <div className="mb-3 flex items-center justify-between">
        <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-700">
          Size {value && <span className="font-normal normal-case tracking-normal text-ink-500">— {value}</span>}
        </legend>
        {onOpenGuide && product.sizeGuide !== 'none' && (
          <button type="button" onClick={onOpenGuide} className="inline-flex items-center gap-1.5 text-xs font-medium text-ink underline underline-offset-4 hover:text-accent-dark">
            <Ruler className="h-3.5 w-3.5" aria-hidden />
            Size guide
          </button>
        )}
      </div>
      <div className={cn('grid gap-2', wide ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-4 sm:grid-cols-5')} role="radiogroup" aria-label="Size" aria-invalid={error || undefined}>
        {product.sizes.map((s) => {
          const available = color ? isSizeAvailable(product, color, s) : false;
          const low = color ? (product.variants.find((v) => v.color === color && v.size === s)?.stock ?? 0) : 0;
          const selected = value === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={!available}
              aria-label={`${s}${!available ? ' — sold out' : low <= LOW_STOCK_THRESHOLD ? ` — only ${low} left` : ''}`}
              onClick={() => available && onChange(s)}
              className={cn(
                'relative flex h-12 items-center justify-center border text-sm font-medium transition-all duration-150',
                selected
                  ? 'border-ink bg-ink text-white'
                  : available
                    ? 'border-paper-300 bg-white text-ink hover:border-ink'
                    : 'cursor-not-allowed border-paper-200 bg-paper-100 text-ink-500/50 line-through decoration-1',
                error && !value && available && 'border-danger/60',
              )}
            >
              {s}
              {available && low <= LOW_STOCK_THRESHOLD && !selected && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
            </button>
          );
        })}
      </div>
      {error && !value && (
        <p className="field-error" role="alert">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden /> Please select a size
        </p>
      )}
    </fieldset>
  );
}

export function StockIndicator({ stock, sizeChosen }: { stock: number; sizeChosen: boolean }) {
  if (stock <= 0) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-danger">
        <span className="h-2 w-2 rounded-full bg-danger" aria-hidden /> Out of stock
      </p>
    );
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-warning">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden /> Only {stock} left{sizeChosen ? ' in this size' : ''}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-success">
      <span className="h-2 w-2 rounded-full bg-success" aria-hidden /> In stock{sizeChosen ? '' : ' — select your size'}
    </p>
  );
}
