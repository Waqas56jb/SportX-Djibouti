import { ArrowRight, Lock, ShoppingBag, Store, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumbs, Button, ButtonLink, EmptyState, ErrorState, SectionHeading, Skeleton } from '@/components/common';
import { CartIssuesAlert, CartLineItem, CouponForm, FreeShippingMeter, TotalsList } from '@/components/cart';
import { ProductCarousel } from '@/components/product';
import { ROUTES } from '@/constants/routes';
import { SITE } from '@/constants/site';
import { useCart } from '@/hooks/useCart';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useFeaturedProducts } from '@/hooks/useProducts';
import { useT } from '@/i18n';

export default function CartPage() {
  const { t } = useT();
  usePageMeta({ title: t('cart.pageTitle'), noindex: true });
  const { items, totals, coupon, count, setQuantity, remove, applyCoupon, removeCoupon, isAccount, syncing, pending, issues, dismissIssues, syncError, refresh } = useCart();
  const blocked = items.some((i) => i.status && i.status !== 'OK');
  const navigate = useNavigate();
  const recs = useFeaturedProducts('bestseller', 8);

  return (
    <div className="bg-white">
      <div className="container-site pb-20 pt-8 sm:pt-10">
        <Breadcrumbs items={[{ label: t('cart.breadcrumb') }]} />
        <div className="mt-6 flex items-end justify-between gap-4">
          <h1 className="heading-xl">{t('cart.title')}</h1>
          {count > 0 && <p className="pb-1 text-sm text-ink-500">{t('common.labels.items', { count })}</p>}
        </div>

        {syncing && items.length === 0 ? (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]" aria-busy="true" aria-label={t('cart.loading')}>
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="aspect-[4/5] w-24 sm:w-32" />
                  <div className="flex-1 space-y-3 pt-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton className="h-80 w-full" />
          </div>
        ) : syncError && isAccount && items.length === 0 ? (
          <ErrorState message={syncError} onRetry={() => void refresh()} className="py-20" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag />}
            title={t('cart.empty.title')}
            description={t('cart.empty.pageBody')}
            action={
              <>
                <ButtonLink to={ROUTES.shop} variant="primary">
                  {t('common.actions.continueShopping')}
                </ButtonLink>
                <ButtonLink to={ROUTES.wishlist} variant="outline">
                  {t('cart.empty.viewWishlist')}
                </ButtonLink>
              </>
            }
          />
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-14 xl:grid-cols-[1fr_440px]">
            <section aria-label={t('cart.itemsLabel')}>
              <div className="border-y border-paper-200 py-5">
                <FreeShippingMeter remaining={totals.freeShippingRemaining} threshold={totals.freeShippingThreshold} />
              </div>
              <CartIssuesAlert issues={issues} onDismiss={dismissIssues} className="mt-5" />
              <ul className="divide-y divide-paper-200 border-b border-paper-200">
                {items.map((item) => (
                  <CartLineItem key={item.id} item={item} size="full" busy={pending} onQuantity={(q) => setQuantity(item.id, q)} onRemove={() => remove(item.id)} />
                ))}
              </ul>
              <div className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
                <div className="flex gap-3 bg-paper-100 p-5">
                  <Truck className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
                  <div>
                    <p className="font-semibold">{t('cart.perks.deliveryTitle')}</p>
                    <p className="mt-1 text-ink-500">{t('cart.perks.deliveryBody')}</p>
                  </div>
                </div>
                <div className="flex gap-3 bg-paper-100 p-5">
                  <Store className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
                  <div>
                    <p className="font-semibold">{t('cart.perks.pickupTitle')}</p>
                    <p className="mt-1 text-ink-500">{SITE.contact.addressLines.slice(0, 2).join(', ')}</p>
                  </div>
                </div>
              </div>
            </section>

            <aside aria-labelledby="summary-title" className="lg:sticky lg:top-24 lg:self-start">
              <div className="border border-paper-200 bg-paper-50 p-5 sm:p-8">
                <h2 id="summary-title" className="heading-md">
                  {t('cart.summary.title')}
                </h2>
                <div className="mt-6">
                  <CouponForm coupon={coupon} onApply={applyCoupon} onRemove={removeCoupon} signedIn={isAccount} />
                </div>
                <div className="mt-6 border-t border-paper-200 pt-6">
                  <TotalsList totals={totals} coupon={coupon} updating={pending} />
                </div>
                <div className="mt-8 space-y-3">
                  {blocked && <p className="text-sm text-danger">{t('cart.summary.blocked')}</p>}
                  <Button variant="primary" size="lg" fullWidth disabled={blocked || pending} onClick={() => navigate(isAccount ? ROUTES.checkout : `${ROUTES.login}?redirect=${encodeURIComponent(ROUTES.checkout)}`)} rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
                    {isAccount ? t('cart.summary.checkout') : t('cart.summary.signInToCheckout')}
                  </Button>
                  <ButtonLink to={ROUTES.shop} variant="outline" size="lg" fullWidth>
                    {t('common.actions.continueShopping')}
                  </ButtonLink>
                </div>
                <p className="mt-5 flex items-center justify-center gap-2 text-xs text-ink-500">
                  <Lock className="h-3.5 w-3.5" aria-hidden /> {t('cart.summary.secure')}
                </p>
              </div>
            </aside>
          </div>
        )}

        <section className="mt-20 border-t border-paper-200 pt-16" aria-labelledby="recs-title">
          <SectionHeading eyebrow={t('cart.recs.eyebrow')} title={<span id="recs-title">{t('cart.recs.title')}</span>} />
          <div className="mt-10">
            <ProductCarousel label={t('cart.recs.label')} products={recs.data} loading={recs.loading} error={recs.error} onRetry={recs.reload} />
          </div>
        </section>
      </div>
    </div>
  );
}
