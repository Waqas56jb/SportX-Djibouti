import { Tag, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/common';
import { cartService, errorMessage } from '@/services';
import type { CartTotals, Coupon } from '@/types';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';

export function SummaryRow({ label, value, strong, accent, muted }: { label: ReactNode; value: ReactNode; strong?: boolean; accent?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', strong ? 'text-base font-semibold text-ink' : 'text-sm', muted && 'text-ink-500')}>
      <dt>{label}</dt>
      <dd className={cn('tabular-nums', accent && 'text-accent-dark', strong && 'text-lg')}>{value}</dd>
    </div>
  );
}

interface TotalsListProps {
  totals: CartTotals;
  coupon?: Coupon | null;
  shippingLabel?: string;
  shippingKnown?: boolean;
}

export function TotalsList({ totals, coupon, shippingLabel = 'Shipping', shippingKnown = false }: TotalsListProps) {
  return (
    <dl className="space-y-3">
      <SummaryRow label="Subtotal" value={formatPrice(totals.subtotal)} />
      {totals.savings > 0 && <SummaryRow label="You save" value={`−${formatPrice(totals.savings)}`} accent muted />}
      {totals.discount > 0 && <SummaryRow label={`Discount${coupon ? ` (${coupon.code})` : ''}`} value={`−${formatPrice(totals.discount)}`} accent />}
      <SummaryRow
        label={shippingKnown ? shippingLabel : `${shippingLabel} (estimate)`}
        value={totals.shipping === 0 ? <span className="font-semibold text-success">Free</span> : formatPrice(totals.shipping)}
      />
      <div className="divider !my-4" />
      <SummaryRow label="Total" value={formatPrice(totals.total)} strong />
      <p className="text-xs text-ink-500">Prices include applicable taxes.</p>
    </dl>
  );
}

export function CouponForm({ subtotal, coupon, onApply }: { subtotal: number; coupon: Coupon | null; onApply: (c: Coupon | null) => void }) {
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return setError('Enter a code');
    setLoading(true);
    setError(null);
    try {
      const c = await cartService.applyCoupon(code, subtotal);
      onApply(c);
      setCode('');
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (coupon) {
    return (
      <div className="flex items-center justify-between gap-3 border border-dashed border-ink/25 bg-paper-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Tag className="h-4 w-4 text-accent-dark" aria-hidden />
          <span className="font-semibold">{coupon.code}</span>
          <span className="text-ink-500">— {coupon.description}</span>
        </div>
        <button type="button" onClick={() => onApply(null)} className="icon-btn h-8 w-8" aria-label="Remove promo code">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Tag className="h-4 w-4" aria-hidden /> Have a promo code?
      </button>
      {open && (
        <form onSubmit={submit} className="mt-3 animate-fade-in" noValidate>
          <div className="flex gap-2">
            <label htmlFor="promo" className="sr-only">
              Promo code
            </label>
            <input
              id="promo"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className={cn('input flex-1 uppercase tracking-wider', error && 'input-error')}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? 'promo-error' : 'promo-hint'}
              autoComplete="off"
            />
            <Button type="submit" variant="outline" loading={loading}>
              Apply
            </Button>
          </div>
          {error ? (
            <p id="promo-error" className="field-error" role="alert">
              {error}
            </p>
          ) : (
            <p id="promo-hint" className="field-hint">
              Demo code: WELCOME10
            </p>
          )}
        </form>
      )}
    </div>
  );
}
