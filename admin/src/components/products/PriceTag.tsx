import { formatMoney } from '@/utils/format';
import { cn } from '@/utils/cn';

/** Price with optional struck-through compare-at price. */
export function PriceTag({ price, compareAt, className, align = 'right' }: { price: number; compareAt?: number; className?: string; align?: 'left' | 'right' }) {
  const onSale = compareAt !== undefined && compareAt > price;
  return (
    <span className={cn('inline-flex flex-col whitespace-nowrap leading-tight tabular', align === 'right' ? 'items-end' : 'items-start', className)}>
      <span className={cn('font-semibold', onSale ? 'text-red-600' : 'text-zinc-900')}>{formatMoney(price)}</span>
      {onSale && (
        <span className="text-xs text-zinc-400 line-through">
          <span className="sr-only">Was </span>
          {formatMoney(compareAt)}
        </span>
      )}
    </span>
  );
}

export const discountPercent = (price: number, compareAt?: number) => (compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0);
