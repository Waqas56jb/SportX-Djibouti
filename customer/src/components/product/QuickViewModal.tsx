import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ErrorState, Modal, Price, QuantitySelector, Rating, Skeleton, SmartImage } from '@/components/common';
import { productPath } from '@/constants/routes';
import { useProduct } from '@/hooks/useProducts';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { WishlistButton } from './WishlistButton';
import { ColorSelector, SizeSelector, StockIndicator } from './VariantSelectors';
import { useProductSelection } from './useProductSelection';

export function QuickViewModal() {
  const slug = useUiStore((s) => s.quickViewSlug);
  const close = useUiStore((s) => s.closeQuickView);
  const { data: product, loading, error, reload } = useProduct(slug ?? undefined);
  const sel = useProductSelection(product);
  const [imageIdx, setImageIdx] = useState(0);

  useEffect(() => {
    setImageIdx(sel.colorImageIndex ?? 0);
  }, [sel.colorImageIndex, product]);

  const handleAdd = () => {
    const ok = sel.add({ openDrawer: false });
    if (ok) close();
  };

  return (
    <Modal open={Boolean(slug)} onClose={close} title={product?.name ?? 'Quick view'} hideTitle size="xl">
      {loading || (!product && !error) ? (
        <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-2">
          <Skeleton className="aspect-[4/5] w-full" />
          <div className="space-y-4 pt-4">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ) : error || !product ? (
        <ErrorState title="Product unavailable" message={error ?? 'This product could not be found.'} onRetry={error ? reload : undefined} />
      ) : (
        <div className="grid md:grid-cols-2">
          <div className="bg-paper-100 md:sticky md:top-0 md:self-start">
            <div className="relative aspect-[4/5]">
              <SmartImage
                key={product.images[imageIdx]?.url}
                src={product.images[imageIdx]?.url ?? product.images[0].url}
                alt={product.images[imageIdx]?.alt ?? product.name}
                sizes="(min-width: 768px) 40vw, 100vw"
                wrapperClassName="absolute inset-0 animate-fade-in"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 p-3">
                {product.images.map((img, i) => (
                  <button
                    key={img.url + i}
                    type="button"
                    onClick={() => setImageIdx(i)}
                    aria-label={`Show image ${i + 1}`}
                    aria-pressed={i === imageIdx}
                    className={cn('relative aspect-square w-14 overflow-hidden border', i === imageIdx ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100')}
                  >
                    <SmartImage src={img.url} alt="" sizes="56px" maxWidth={320} wrapperClassName="absolute inset-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6 p-5 sm:p-8">
            <div className="pr-10">
              <p className="eyebrow">{product.brand}</p>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase leading-none sm:text-4xl">{product.name}</h2>
              <Rating value={product.rating} count={product.reviewCount} showValue className="mt-3" />
              <Price price={product.price} compareAtPrice={product.compareAtPrice} size="lg" showDiscount className="mt-4" />
            </div>
            <p className="text-sm leading-relaxed text-ink-600">{product.shortDescription}</p>
            <ColorSelector product={product} value={sel.color} onChange={sel.selectColor} error={sel.error === 'color'} />
            <SizeSelector product={product} color={sel.color} value={sel.size} onChange={sel.selectSize} error={sel.error === 'size'} />
            <StockIndicator stock={sel.soldOut ? 0 : sel.selectedStock} sizeChosen={Boolean(sel.size)} />
            <div className="flex gap-3">
              <QuantitySelector value={sel.quantity} onChange={sel.setQuantity} max={sel.maxQuantity} disabled={sel.soldOut || sel.variantSoldOut} />
              <Button variant="primary" fullWidth className="flex-1" onClick={handleAdd} disabled={sel.soldOut || sel.variantSoldOut}>
                {sel.soldOut ? 'Out of stock' : 'Add to bag'}
              </Button>
              <WishlistButton product={product} variant="outline" className="h-12 w-12" />
            </div>
            <Link to={productPath(product.slug)} onClick={close} className="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink">
              <span className="link-underline">View full details</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
