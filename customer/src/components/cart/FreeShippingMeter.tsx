import { Truck } from 'lucide-react';
import { useT } from '@/i18n';
import { formatPrice } from '@/utils/format';
import { RichText } from './RichText';

/** Free-delivery progress. Threshold and remaining come from the server cart (or `/store` for guests). */
export function FreeShippingMeter({ remaining, threshold }: { remaining: number; threshold: number | null | undefined }) {
  const { t } = useT();
  if (!threshold || threshold <= 0) return null;
  const progress = Math.max(0, Math.min(100, ((threshold - remaining) / threshold) * 100));
  const done = remaining <= 0;
  return (
    <div>
      <p className="flex items-center gap-2 text-xs text-ink-700">
        <Truck className="h-4 w-4 shrink-0" aria-hidden />
        {done ? (
          <span>
            <strong className="font-semibold text-ink">{t('cart.freeShipping.unlocked')}</strong>
          </span>
        ) : (
          <span>
            <RichText text={t('cart.freeShipping.addMore')} parts={{ amount: <strong className="font-semibold text-ink">{formatPrice(remaining)}</strong> }} />
          </span>
        )}
      </p>
      <div className="mt-2.5 h-1 w-full overflow-hidden bg-paper-200" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={t('cart.freeShipping.progress')}>
        <div className="h-full bg-ink transition-[width] duration-700 ease-premium" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
