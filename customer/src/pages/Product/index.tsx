import { RotateCcw, ShieldCheck, Store, Truck, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Breadcrumbs, Button, ErrorState, Price, QuantitySelector, Rating, SectionHeading, Skeleton } from '@/components/common';
import {
  ColorSelector,
  ProductCarousel,
  ProductGallery,
  SizeGuideModal,
  SizeSelector,
  StockIndicator,
  WishlistButton,
  useProductSelection,
  type ProductSelection,
} from '@/components/product';
import { ProductReviews } from '@/components/review/Reviews';
import { SPORT_LABELS } from '@/constants/labels';
import { ROUTES } from '@/constants/routes';
import { SITE } from '@/constants/site';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useProduct, useProductsBySlugs } from '@/hooks/useProducts';
import { useIsVisible } from '@/hooks/useUi';
import NotFoundPage from '@/pages/NotFound';
import { categoryLabel, productService } from '@/services/productService';
import { useRecentlyViewedStore } from '@/store/historyStores';
import type { Product } from '@/types';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';
import { discountPercent } from '@/utils/product';
import { ProductDetails } from './ProductDetails';

const BADGE_LABEL = { new: 'New', bestseller: 'Best Seller', limited: 'Limited', exclusive: 'Exclusive' } as const;

function ProductSkeleton() {
  return (
    <div className="container-site grid grid-cols-1 gap-10 py-8 lg:grid-cols-[1.25fr_1fr] lg:gap-16" aria-busy="true" aria-label="Loading product">
      <Skeleton className="aspect-[4/5] w-full" />
      <div className="space-y-5 pt-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-4/5" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}

function PurchasePanel({ product, sel }: { product: Product; sel: ProductSelection }) {
  const navigate = useNavigate();
  const [guide, setGuide] = useState(false);
  const { ref: ctaRef, visible: ctaVisible } = useIsVisible<HTMLDivElement>();
  const pct = discountPercent(product.price, product.compareAtPrice);
  const disabled = sel.soldOut || sel.variantSoldOut;

  const scrollToOptions = () => document.getElementById('purchase-options')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const addToBag = async () => {
    const ok = await sel.add();
    if (!ok) scrollToOptions();
  };

  const buyNow = async () => {
    const ok = await sel.add({ openDrawer: false, silent: true });
    if (ok) navigate(ROUTES.checkout);
    else scrollToOptions();
  };
  const freeFrom = product.shipping?.freeShippingThreshold;
  const pickup = product.shipping?.methods.find((m) => !m.requiresAddress);

  return (
    <>
      <div className="lg:sticky lg:top-24">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow text-ink">{product.brand}</p>
          <span className="text-ink-500/50">·</span>
          <p className="eyebrow">{categoryLabel(product)}</p>
        </div>
        <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[0.92] tracking-[-0.01em] sm:text-5xl xl:text-[3.5rem]">{product.name}</h1>
        <a href="#reviews" className="mt-4 inline-flex items-center gap-2 hover:underline">
          <Rating value={product.rating} count={product.reviewCount} showValue size="sm" />
        </a>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Price price={product.price} compareAtPrice={product.compareAtPrice} size="xl" />
          {pct > 0 && <Badge tone="sale">Save {pct}%</Badge>}
        </div>
        <p className="mt-5 text-[15px] leading-relaxed text-ink-600">{product.shortDescription}</p>

        <div id="purchase-options" className="mt-8 space-y-7 border-t border-paper-200 pt-8">
          <ColorSelector product={product} value={sel.color} onChange={sel.selectColor} error={sel.error === 'color'} />
          <SizeSelector product={product} color={sel.color} value={sel.size} onChange={sel.selectSize} error={sel.error === 'size'} onOpenGuide={() => setGuide(true)} />
          <StockIndicator
            stock={sel.soldOut ? 0 : sel.selectedStock}
            sizeChosen={Boolean(sel.size) && product.sizes.length > 1}
            status={sel.soldOut ? 'OUT_OF_STOCK' : sel.size ? sel.variant?.stockStatus : undefined}
          />

          <div ref={ctaRef} className="space-y-3">
            <div className="flex gap-3">
              <QuantitySelector value={sel.quantity} onChange={sel.setQuantity} max={sel.maxQuantity} disabled={disabled} className="h-14" />
              <Button variant="primary" size="lg" className="h-14 min-w-0 flex-1 px-4 sm:px-8" onClick={addToBag} loading={sel.adding} disabled={disabled}>
                {sel.soldOut ? 'Out of stock' : sel.variantSoldOut ? 'Size sold out' : 'Add to bag'}
              </Button>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="h-14 min-w-0 flex-1" onClick={buyNow} disabled={disabled} leftIcon={<Zap className="h-4 w-4" />}>
                Buy now
              </Button>
              <WishlistButton product={product} variant="outline" />
            </div>
          </div>
        </div>

        <ul className="mt-8 grid gap-px border border-paper-200 bg-paper-200 text-sm sm:grid-cols-3">
          {[
            { icon: Truck, title: 'Delivery', text: freeFrom ? `Free over ${formatPrice(freeFrom)}` : 'Across Djibouti' },
            { icon: Store, title: 'Store pickup', text: pickup ? (pickup.price === 0 ? 'Free · Place Menelik' : formatPrice(pickup.price)) : 'Place Menelik' },
            { icon: RotateCcw, title: 'Easy returns', text: 'Unworn items' },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3 bg-white p-4 sm:flex-col sm:items-start sm:gap-2">
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-xs text-ink-500">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-500">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Secure checkout · Questions? Call {SITE.contact.phone}
        </p>
      </div>

      {/* Sticky mobile purchase bar — appears once the main CTA scrolls away */}
      <div
        className={cn(
          'safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-paper-200 bg-white/95 backdrop-blur transition-transform duration-300 ease-premium lg:hidden',
          ctaVisible ? 'translate-y-full' : 'translate-y-0',
        )}
        aria-hidden={ctaVisible}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{product.name}</p>
            <p className="text-xs text-ink-500">
              {formatPrice(product.price)}
              {sel.size && product.sizes.length > 1 ? ` · ${sel.size}` : ''}
            </p>
          </div>
          <Button
            variant="primary"
            className="shrink-0"
            onClick={() => (sel.size || product.sizes.length <= 1 ? void addToBag() : scrollToOptions())}
            disabled={sel.soldOut}
            tabIndex={ctaVisible ? -1 : 0}
          >
            {sel.soldOut ? 'Sold out' : sel.size || product.sizes.length <= 1 ? 'Add to bag' : 'Select size'}
          </Button>
        </div>
      </div>

      <SizeGuideModal open={guide} onClose={() => setGuide(false)} type={product.sizeGuide} />
    </>
  );
}

function ProductRails({ product }: { product: Product }) {
  const related = useAsync(() => productService.getRelated(product, 10), [product.id]);
  const look = useAsync(() => productService.getCompleteTheLook(product, 4), [product.id]);
  const recentSlugs = useRecentlyViewedStore((s) => s.slugs).filter((s) => s !== product.slug).slice(0, 8);
  const recent = useProductsBySlugs(recentSlugs);

  return (
    <>
      {(look.loading || (look.data && look.data.length > 0)) && (
        <section className="border-t border-paper-200 py-16 sm:py-20" aria-labelledby="look-title">
          <SectionHeading eyebrow="Style it with" title={<span id="look-title">Complete the look</span>} />
          <div className="mt-10">
            <ProductCarousel label="Complete the look" products={look.data} loading={look.loading} error={look.error} onRetry={look.reload} />
          </div>
        </section>
      )}
      <section className="border-t border-paper-200 py-16 sm:py-20" aria-labelledby="related-title">
        <SectionHeading eyebrow={`More ${SPORT_LABELS[product.sport]}`} title={<span id="related-title">You may also like</span>} />
        <div className="mt-10">
          <ProductCarousel label="Related products" products={related.data} loading={related.loading} error={related.error} onRetry={related.reload} />
        </div>
      </section>
      {recentSlugs.length > 0 && recent.data && recent.data.length > 0 && (
        <section className="border-t border-paper-200 py-16 sm:py-20" aria-labelledby="recent-title">
          <SectionHeading eyebrow="Your history" title={<span id="recent-title">Recently viewed</span>} />
          <div className="mt-10">
            <ProductCarousel label="Recently viewed" products={recent.data} />
          </div>
        </section>
      )}
    </>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const { data: product, loading, error, reload } = useProduct(slug);
  const addRecent = useRecentlyViewedStore((s) => s.add);
  const sel = useProductSelection(product);

  useEffect(() => {
    if (product) addRecent(product.slug);
  }, [product, addRecent]);

  usePageMeta({
    title: product?.name ?? (loading ? 'Loading' : 'Product'),
    description: product?.shortDescription,
    path: slug ? `/product/${slug}` : undefined,
    image: product?.images[0]?.url,
    jsonLd: product
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          brand: { '@type': 'Brand', name: product.brand },
          description: product.description,
          image: product.images.map((i) => i.url),
          sku: product.id,
          aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviewCount },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'DJF',
            price: product.price,
            availability: product.stockStatus !== 'OUT_OF_STOCK' && product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
        }
      : undefined,
  });

  if (loading || (!product && !error && slug)) return <ProductSkeleton />;
  if (error) {
    return (
      <div className="container-site">
        <ErrorState title="We couldn’t load this product" message={error} onRetry={reload} className="py-24" />
      </div>
    );
  }
  if (!product) {
    return <NotFoundPage title="This product has left the field." message="The product you’re looking for is no longer available or the link is incorrect. Explore the latest gear instead." />;
  }

  const pct = discountPercent(product.price, product.compareAtPrice);

  return (
    <div className="pb-24 lg:pb-0">
      <div className="container-site pt-5 sm:pt-6">
        <Breadcrumbs
          items={[
            { label: 'Shop', href: '/shop' },
            { label: SPORT_LABELS[product.sport], href: product.sport === 'lifestyle' ? '/shop?sport=lifestyle' : `/${product.sport}` },
            { label: product.name },
          ]}
        />
      </div>
      <div className="container-site mt-5 grid grid-cols-1 gap-8 sm:mt-6 lg:grid-cols-[1.25fr_1fr] lg:gap-14 xl:gap-20">
        <div className="-mx-4 min-w-0 sm:-mx-6 lg:mx-0">
          <ProductGallery
            images={product.images}
            activeIndex={sel.colorImageIndex ?? 0}
            badges={
              <>
                {sel.soldOut && <Badge tone="neutral">Sold Out</Badge>}
                {pct > 0 && <Badge tone="sale">−{pct}%</Badge>}
                {product.badge && <Badge tone="dark">{BADGE_LABEL[product.badge]}</Badge>}
              </>
            }
          />
        </div>
        <div className="min-w-0 lg:py-2">
          <PurchasePanel product={product} sel={sel} />
        </div>
      </div>
      <div className="container-site">
        <ProductDetails product={product} />
        <ProductReviews product={product} />
        <ProductRails product={product} />
      </div>
    </div>
  );
}
