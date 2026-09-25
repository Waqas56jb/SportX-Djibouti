import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorState } from '@/components/common';
import type { Product } from '@/types';
import { cn } from '@/utils/cn';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from './ProductGrid';
import { useT } from '@/i18n';

interface ProductCarouselProps {
  products: Product[] | undefined;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  tone?: 'light' | 'dark';
  label: string;
  /** Visible cards per breakpoint are driven by card width classes. */
  cardClassName?: string;
}

/**
 * Horizontal, scroll-snapping product rail. Native scrolling keeps it
 * swipe-friendly on touch; arrow buttons page through on desktop.
 */
export function ProductCarousel({ products, loading, error, onRetry, tone = 'light', label, cardClassName }: ProductCarouselProps) {
  const { t, rtl } = useT();
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    // In RTL scrollLeft runs from 0 towards negative values; the magnitude is the distance from the start.
    const pos = Math.abs(el.scrollLeft);
    setEdges({ start: pos <= 4, end: pos + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    const el = track.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update, products]);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: (rtl ? -dir : dir) * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const cardWidth = cn('w-[72%] shrink-0 snap-start xs:w-[62%] sm:w-[42%] md:w-[31%] xl:w-[23.5%]', cardClassName);
  const arrow = cn(
    'flex h-11 w-11 items-center justify-center rounded-full border transition-all duration-200 disabled:pointer-events-none disabled:opacity-30',
    tone === 'dark' ? 'border-white/25 text-white hover:bg-white hover:text-ink' : 'border-ink/15 text-ink hover:bg-ink hover:text-white',
  );

  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="mb-5 hidden justify-end gap-2 md:flex">
        <button type="button" className={arrow} onClick={() => page(-1)} disabled={edges.start} aria-label={t('product.carousel.previous')}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button type="button" className={arrow} onClick={() => page(1)} disabled={edges.end} aria-label={t('product.carousel.next')}>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <ul
        ref={track}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:gap-5 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0"
      >
        {loading || !products
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i} className={cardWidth}>
                <ProductCardSkeleton />
              </li>
            ))
          : products.map((p) => (
              <li key={p.id} className={cn(cardWidth, 'flex')}>
                <ProductCard product={p} tone={tone} className="w-full" sizes="(min-width: 1280px) 24vw, (min-width: 768px) 32vw, 70vw" />
              </li>
            ))}
      </ul>
    </div>
  );
}
