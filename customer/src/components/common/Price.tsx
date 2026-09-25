import { t } from '@/i18n';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';
import { discountPercent } from '@/utils/product';

interface PriceProps {
  price: number;
  compareAtPrice?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showDiscount?: boolean;
  className?: string;
  tone?: 'dark' | 'light';
}

const SIZES = {
  sm: 'text-sm',
  md: 'text-[15px]',
  lg: 'text-xl',
  xl: 'text-2xl sm:text-[1.75rem]',
} as const;

export function Price({ price, compareAtPrice, size = 'md', showDiscount = false, className, tone = 'dark' }: PriceProps) {
  const pct = discountPercent(price, compareAtPrice);
  const onSale = pct > 0;
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn('font-semibold tabular-nums', SIZES[size], onSale ? (tone === 'light' ? 'text-accent' : 'text-accent-dark') : tone === 'light' ? 'text-white' : 'text-ink')}>
        <span className="sr-only">{onSale ? t('common.ui.salePrice') : t('common.ui.price')}{' '}</span>
        {formatPrice(price)}
      </span>
      {onSale && (
        <>
          <s className={cn('tabular-nums', size === 'xl' || size === 'lg' ? 'text-base' : 'text-xs', tone === 'light' ? 'text-white/50' : 'text-ink-500')}>
            <span className="sr-only">{t('common.ui.originalPrice')} </span>
            {formatPrice(compareAtPrice as number)}
          </s>
          {showDiscount && <span className={cn('text-xs font-bold uppercase tracking-wide', tone === 'light' ? 'text-accent' : 'text-accent-dark')}>−{pct}%</span>}
        </>
      )}
    </div>
  );
}
