import { Truck } from 'lucide-react';
import { formatPrice } from '@/utils/format';

/** Free-delivery progress. Threshold and remaining come from the server cart (or `/store` for guests). */
export function FreeShippingMeter({ remaining, threshold }: { remaining: number; threshold: number | null | undefined }) {
  if (!threshold || threshold <= 0) return null;
  const progress = Math.max(0, Math.min(100, ((threshold - remaining) / threshold) * 100));
  const done = remaining <= 0;
  return (
    <div>
      <p className="flex items-center gap-2 text-xs text-ink-700">
        <Truck className="h-4 w-4 shrink-0" aria-hidden />
        {done ? (
          <span>
            <strong className="font-semibold text-ink">You’ve unlocked free delivery.</strong>
          </span>
        ) : (
          <span>
            Add <strong className="font-semibold text-ink">{formatPrice(remaining)}</strong> more for free delivery
          </span>
        )}
      </p>
      <div className="mt-2.5 h-1 w-full overflow-hidden bg-paper-200" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to free delivery">
        <div className="h-full bg-ink transition-[width] duration-700 ease-premium" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
