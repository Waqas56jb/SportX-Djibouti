import { Star } from 'lucide-react';
import { t, tDynamic } from '@/i18n';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/format';

interface RatingProps {
  value: number;
  count?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}

const SIZE = { xs: 'h-3 w-3', sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' } as const;

/** Read-only star rating with partial-star fill. */
export function Rating({ value, count, size = 'sm', showValue = false, className }: RatingProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="relative flex" role="img" aria-label={count !== undefined ? t('common.rating.withCount', { rating: value.toFixed(1), count }) : t('common.a11y.rating', { rating: value.toFixed(1) })}>
        <div className="flex gap-0.5 text-paper-300">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={cn(SIZE[size], 'fill-current')} aria-hidden strokeWidth={0} />
          ))}
        </div>
        <div className="absolute inset-0 flex gap-0.5 overflow-hidden text-ink" style={{ width: `${(value / 5) * 100}%` }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={cn(SIZE[size], 'shrink-0 fill-current')} aria-hidden strokeWidth={0} />
          ))}
        </div>
      </div>
      {showValue && <span className="text-xs font-semibold text-ink">{value.toFixed(1)}</span>}
      {count !== undefined && <span className="text-xs text-ink-500">({formatNumber(count)})</span>}
    </div>
  );
}

interface RatingInputProps {
  value: number;
  onChange: (value: number) => void;
  error?: string;
}


export function RatingInput({ value, onChange, error }: RatingInputProps) {
  return (
    <fieldset>
      <legend className="label">{t('common.rating.yourRating')}</legend>
      <div className="flex items-center gap-3">
        <div className="flex gap-1" role="radiogroup" aria-label={t('common.rating.label')}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={t('common.rating.stars', { count: n })}
              onClick={() => onChange(n)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star className={cn('h-7 w-7', n <= value ? 'fill-ink text-ink' : 'fill-paper-200 text-paper-300')} strokeWidth={1} />
            </button>
          ))}
        </div>
        <span className="text-sm font-medium text-ink-500">{value >= 1 && value <= 5 ? tDynamic(`common.rating.level${value}`, '') : ''}</span>
      </div>
      {error && <p className="field-error">{error}</p>}
    </fieldset>
  );
}
