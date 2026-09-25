import { Tag, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useT } from '@/i18n';
import { errorMessage } from '@/services';
import type { CartTotals, Coupon } from '@/types';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';
import { RichText } from './RichText';

export function SummaryRow({ label, value, strong, accent, muted }: { label: ReactNode; value: ReactNode; strong?: boolean; accent?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', strong ? 'text-base font-semibold text-ink' : 'text-sm', muted && 'text-ink-500')}>
      <dt className="min-w-0">{label}</dt>
      <dd className={cn('shrink-0 tabular-nums', accent && 'text-accent-dark', strong && 'text-lg')}>{value}</dd>
    </div>
  );
}

interface TotalsListProps {
  totals: CartTotals;
  coupon?: Coupon | null;
  shippingLabel?: string;
  /** True once a shipping method is priced by the server (checkout). */
  shippingKnown?: boolean;
  /** Totals are being re-priced by the server. */
  updating?: boolean;
}

/**
 * Order totals. Signed-in bag / checkout: the server's numbers verbatim.
 * Guest bag: an estimate — shipping, promo codes and tax are priced at checkout.
 */
export function TotalsList({ totals, coupon, shippingLabel, shippingKnown = false, updating = false }: TotalsListProps) {
  const { t } = useT();
  return (
    <dl className={cn('space-y-3 transition-opacity', updating && 'opacity-60')} aria-busy={updating}>
      <SummaryRow label={t('common.labels.subtotal')} value={formatPrice(totals.subtotal)} />
      {totals.productDiscount > 0 && <SummaryRow label={t('cart.totals.promotions')} value={<span className="ltr-text">−{formatPrice(totals.productDiscount)}</span>} accent />}
      {totals.estimated && totals.savings > 0 && <SummaryRow label={t('cart.totals.youSave')} value={<span className="ltr-text">−{formatPrice(totals.savings)}</span>} accent muted />}
      {totals.discount > 0 && <SummaryRow label={coupon ? <RichText text={t('cart.totals.promoCodeWith')} parts={{ code: <span className="ltr-text">{coupon.code}</span> }} /> : t('cart.totals.promoCode')} value={<span className="ltr-text">−{formatPrice(totals.discount)}</span>} accent />}
      <SummaryRow
        label={shippingKnown && shippingLabel ? shippingLabel : t('cart.totals.shipping')}
        value={
          !shippingKnown ? (
            <span className="text-ink-500">{t('cart.totals.calculatedAtCheckout')}</span>
          ) : totals.shipping === 0 ? (
            <span className="font-semibold text-success">{t('common.labels.free')}</span>
          ) : (
            formatPrice(totals.shipping)
          )
        }
      />
      {totals.tax > 0 && !totals.taxInclusive && <SummaryRow label={t('cart.totals.tax')} value={formatPrice(totals.tax)} />}
      <div className="divider !my-4" />
      <SummaryRow label={totals.estimated ? t('cart.totals.estimatedTotal') : t('common.labels.total')} value={formatPrice(totals.total)} strong />
      <p className="text-xs text-ink-500">
        {totals.estimated
          ? t('cart.totals.estimatedNote')
          : totals.tax > 0 && totals.taxInclusive
            ? t('cart.totals.taxIncluded', { amount: formatPrice(totals.tax) })
            : t('cart.totals.taxesApplicable')}
      </p>
    </dl>
  );
}

interface CouponFormProps {
  coupon: Coupon | null;
  /** Applies the code on the server cart; throws with a friendly message when invalid. */
  onApply: (code: string) => Promise<void>;
  onRemove: () => Promise<void> | void;
  /** Guests cannot use codes (they are stored on the account bag). */
  signedIn: boolean;
}

export function CouponForm({ coupon, onApply, onRemove, signedIn }: CouponFormProps) {
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const { t } = useT();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return setError(t('cart.coupon.enterCode'));
    setLoading(true);
    setError(null);
    try {
      await onApply(code);
      setCode('');
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err, t('cart.coupon.invalid')));
    } finally {
      setLoading(false);
    }
  };

  if (coupon) {
    return (
      <div className="flex items-center justify-between gap-3 border border-dashed border-ink/25 bg-paper-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Tag className="h-4 w-4 shrink-0 text-accent-dark" aria-hidden />
          <span className="ltr-text font-semibold">{coupon.code}</span>
          {coupon.description && <span className="truncate text-ink-500">— {coupon.description}</span>}
        </div>
        <button
          type="button"
          onClick={async () => {
            setRemoving(true);
            try {
              await onRemove();
            } finally {
              setRemoving(false);
            }
          }}
          disabled={removing}
          className="icon-btn h-8 w-8 shrink-0"
          aria-label={t('cart.coupon.remove')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-500">
        <Tag className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <RichText
            text={t('cart.coupon.guestPrompt')}
            parts={{
              link: (
                <Link to={`${ROUTES.login}?redirect=${encodeURIComponent(location.pathname)}`} className="font-semibold text-ink underline underline-offset-4">
                  {t('common.actions.signIn')}
                </Link>
              ),
            }}
          />
        </span>
      </p>
    );
  }

  return (
    <div>
      <button type="button" className="flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Tag className="h-4 w-4" aria-hidden /> {t('cart.coupon.have')}
      </button>
      {open && (
        <form onSubmit={submit} className="mt-3 animate-fade-in" noValidate>
          <div className="flex gap-2">
            <label htmlFor="promo" className="sr-only">
              {t('cart.coupon.label')}
            </label>
            <input
              id="promo"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              placeholder={t('cart.coupon.placeholder')}
              className={cn('input min-w-0 flex-1 uppercase tracking-wider', error && 'input-error')}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? 'promo-error' : undefined}
              autoComplete="off"
              maxLength={40}
            />
            <Button type="submit" variant="outline" loading={loading} className="shrink-0">
              {t('common.actions.apply')}
            </Button>
          </div>
          {error && (
            <p id="promo-error" className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
