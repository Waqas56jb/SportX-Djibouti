import { ArrowRight, Lock, ShoppingBag, Store, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumbs, Button, ButtonLink, EmptyState, SectionHeading } from '@/components/common';
import { CartLineItem, CouponForm, FreeShippingMeter, TotalsList } from '@/components/cart';
import { ProductCarousel } from '@/components/product';
import { ROUTES } from '@/constants/routes';
import { SITE } from '@/constants/site';
import { useCart } from '@/hooks/useCart';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useFeaturedProducts } from '@/hooks/useProducts';
import { pluralize } from '@/utils/format';

export default function CartPage() {
  usePageMeta({ title: 'Your Bag', noindex: true });
  const { items, totals, coupon, count, setQuantity, remove, setCoupon } = useCart();
  const navigate = useNavigate();
  const recs = useFeaturedProducts('bestseller', 8);

  return (
    <div className="bg-white">
      <div className="container-site pb-20 pt-8 sm:pt-10">
        <Breadcrumbs items={[{ label: 'Bag' }]} />
        <div className="mt-6 flex items-end justify-between gap-4">
          <h1 className="heading-xl">Your bag</h1>
          {count > 0 && <p className="pb-1 text-sm text-ink-500">{pluralize(count, 'item')}</p>}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag />}
            title="Your bag is empty"
            description="Nothing here yet. Explore new arrivals and best sellers to gear up for your next session."
            action={
              <>
                <ButtonLink to={ROUTES.shop} variant="primary">
                  Continue shopping
                </ButtonLink>
                <ButtonLink to={ROUTES.wishlist} variant="outline">
                  View wishlist
                </ButtonLink>
              </>
            }
          />
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-14 xl:grid-cols-[1fr_440px]">
            <section aria-label="Bag items">
              <div className="border-y border-paper-200 py-5">
                <FreeShippingMeter remaining={totals.freeShippingRemaining} />
              </div>
              <ul className="divide-y divide-paper-200 border-b border-paper-200">
                {items.map((item) => (
                  <CartLineItem key={item.id} item={item} size="full" onQuantity={(q) => setQuantity(item.id, q)} onRemove={() => remove(item.id)} />
                ))}
              </ul>
              <div className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
                <div className="flex gap-3 bg-paper-100 p-5">
                  <Truck className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
                  <div>
                    <p className="font-semibold">Delivery across Djibouti</p>
                    <p className="mt-1 text-ink-500">Options and timings confirmed at checkout.</p>
                  </div>
                </div>
                <div className="flex gap-3 bg-paper-100 p-5">
                  <Store className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
                  <div>
                    <p className="font-semibold">Free store pickup</p>
                    <p className="mt-1 text-ink-500">{SITE.contact.addressLines.slice(0, 2).join(', ')}</p>
                  </div>
                </div>
              </div>
            </section>

            <aside aria-labelledby="summary-title" className="lg:sticky lg:top-24 lg:self-start">
              <div className="border border-paper-200 bg-paper-50 p-6 sm:p-8">
                <h2 id="summary-title" className="heading-md">
                  Order summary
                </h2>
                <div className="mt-6">
                  <CouponForm subtotal={totals.subtotal} coupon={coupon} onApply={setCoupon} />
                </div>
                <div className="mt-6 border-t border-paper-200 pt-6">
                  <TotalsList totals={totals} coupon={coupon} />
                </div>
                <div className="mt-8 space-y-3">
                  <Button variant="primary" size="lg" fullWidth onClick={() => navigate(ROUTES.checkout)} rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
                    Proceed to checkout
                  </Button>
                  <ButtonLink to={ROUTES.shop} variant="outline" size="lg" fullWidth>
                    Continue shopping
                  </ButtonLink>
                </div>
                <p className="mt-5 flex items-center justify-center gap-2 text-xs text-ink-500">
                  <Lock className="h-3.5 w-3.5" aria-hidden /> Secure checkout
                </p>
              </div>
            </aside>
          </div>
        )}

        <section className="mt-20 border-t border-paper-200 pt-16" aria-labelledby="recs-title">
          <SectionHeading eyebrow="Complete your kit" title={<span id="recs-title">Popular right now</span>} />
          <div className="mt-10">
            <ProductCarousel label="Recommended products" products={recs.data} loading={recs.loading} error={recs.error} onRetry={recs.reload} />
          </div>
        </section>
      </div>
    </div>
  );
}
