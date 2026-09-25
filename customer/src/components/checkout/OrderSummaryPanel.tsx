import { ChevronDown, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { SmartImage } from '@/components/common';
import { CouponForm, TotalsList } from '@/components/cart';
import { RichText } from '@/components/cart/RichText';
import { useT } from '@/i18n';
import type { CartItem, CartTotals, Coupon } from '@/types';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';

interface OrderSummaryProps {
  items: CartItem[];
  totals: CartTotals;
  coupon: Coupon | null;
  onApplyCoupon: (code: string) => Promise<void>;
  onRemoveCoupon: () => Promise<void> | void;
  shippingKnown: boolean;
  shippingLabel?: string;
  /** Server is re-pricing (validate in flight). */
  updating?: boolean;
  /** Hide the promo form (e.g. while paying an already-created order). */
  lockCoupon?: boolean;
}

function SummaryBody({ items, totals, coupon, onApplyCoupon, onRemoveCoupon, shippingKnown, shippingLabel, updating, lockCoupon }: OrderSummaryProps) {
  const { t } = useT();
  return (
    <>
      <ul className="space-y-4">
        {items.map((i) => (
          <li key={i.id} className="flex gap-3 sm:gap-4">
            <div className="relative w-16 shrink-0">
              <div className="relative aspect-[4/5] overflow-hidden bg-paper-100">
                <SmartImage src={i.image} alt={i.name} sizes="64px" maxWidth={320} wrapperClassName="absolute inset-0" />
              </div>
              <span className="absolute -end-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">{i.quantity}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">{i.name}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {i.color} · {i.size}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(i.lineTotal ?? i.unitPrice * i.quantity)}</p>
          </li>
        ))}
      </ul>
      <div className="my-6 border-t border-paper-200 pt-6">
        {lockCoupon ? (
          coupon && (
            <p className="text-sm text-ink-500">
              <RichText text={t('checkout.summary.promoApplied')} parts={{ code: <span className="ltr-text">{coupon.code}</span> }} />
            </p>
          )
        ) : (
          <CouponForm coupon={coupon} onApply={onApplyCoupon} onRemove={onRemoveCoupon} signedIn />
        )}
      </div>
      <TotalsList totals={totals} coupon={coupon} shippingKnown={shippingKnown} shippingLabel={shippingLabel} updating={updating} />
    </>
  );
}

/** Always-visible sidebar on desktop. */
export function OrderSummaryPanel(props: OrderSummaryProps) {
  const { t } = useT();
  return (
    <aside aria-labelledby="checkout-summary" className="hidden lg:block">
      <div className="sticky top-8 border border-paper-200 bg-white p-8">
        <h2 id="checkout-summary" className="heading-sm mb-6">
          {t('checkout.summary.title')}
        </h2>
        <SummaryBody {...props} />
      </div>
    </aside>
  );
}

/** Collapsible summary shown above the form on mobile/tablet. */
export function MobileOrderSummary(props: OrderSummaryProps) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  return (
    <div className="border-b border-paper-200 bg-white lg:hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="container-site flex h-14 w-full items-center justify-between gap-3" aria-expanded={open} aria-controls="mobile-summary">
        <span className="flex min-w-0 items-center gap-2 text-start text-sm font-semibold">
          <ShoppingBag className="h-4 w-4" aria-hidden />
          {open ? t('checkout.summary.hide') : t('checkout.summary.show')}
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-300', open && 'rotate-180')} aria-hidden />
        </span>
        <span className="shrink-0 text-base font-semibold tabular-nums">{formatPrice(props.totals.total)}</span>
      </button>
      <div id="mobile-summary" className={cn('grid transition-[grid-template-rows] duration-300 ease-premium', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="container-site pb-6 pt-2">
            <SummaryBody {...props} />
          </div>
        </div>
      </div>
    </div>
  );
}
