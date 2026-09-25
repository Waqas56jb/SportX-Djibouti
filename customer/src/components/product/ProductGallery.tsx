import { ZoomIn } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { SmartImage } from '@/components/common';
import type { ProductImage } from '@/types';
import { cn } from '@/utils/cn';
import { useT } from '@/i18n';

interface ProductGalleryProps {
  images: ProductImage[];
  /** Jump to this image (e.g. when a colour is selected). */
  activeIndex?: number;
  badges?: ReactNode;
}

/**
 * Desktop: vertical thumbnails + main image with cursor-follow zoom.
 * Mobile/tablet: swipeable scroll-snap strip with position indicator.
 */
export function ProductGallery({ images, activeIndex = 0, badges }: ProductGalleryProps) {
  const { t, rtl } = useT();
  const [current, setCurrent] = useState(activeIndex);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(activeIndex);
    const el = strip.current;
    if (el) el.scrollTo({ left: (rtl ? -1 : 1) * el.clientWidth * activeIndex, behavior: 'smooth' });
  }, [activeIndex, rtl]);

  const onStripScroll = () => {
    const el = strip.current;
    if (!el) return;
    const idx = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (idx !== current) setCurrent(idx);
  };

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };

  const active = images[current] ?? images[0];

  return (
    <div className="relative">
      {/* Mobile / tablet swipe gallery */}
      <div className="relative lg:hidden">
        <div ref={strip} onScroll={onStripScroll} className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto" aria-label={t('product.gallery.images')}>
          {images.map((img, i) => (
            <div key={img.url + i} className="relative aspect-[4/5] w-full shrink-0 snap-center">
              <SmartImage src={img.url} alt={img.alt} sizes="100vw" priority={i === 0} wrapperClassName="absolute inset-0" />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/85 px-3 py-2 backdrop-blur" aria-hidden>
            {images.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-all duration-300', i === current ? 'w-5 bg-ink' : 'w-1.5 bg-ink/25')} />
            ))}
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {t('product.gallery.position', { current: current + 1, total: images.length })}
        </p>
      </div>

      {/* Desktop gallery */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-[76px_1fr] xl:grid-cols-[88px_1fr]">
        <div className="flex flex-col gap-3" role="tablist" aria-label={t('product.gallery.thumbnails')} aria-orientation="vertical">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={t('product.gallery.showImageAlt', { n: i + 1, alt: img.alt })}
              onClick={() => setCurrent(i)}
              onMouseEnter={() => setCurrent(i)}
              className={cn('relative aspect-[4/5] w-full overflow-hidden border transition-all duration-200', i === current ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100')}
            >
              <SmartImage src={img.url} alt="" sizes="96px" maxWidth={320} wrapperClassName="absolute inset-0" />
            </button>
          ))}
        </div>
        <div
          className="group relative aspect-[4/5] cursor-zoom-in overflow-hidden bg-paper-100"
          onMouseMove={onMove}
          onMouseLeave={() => setZoom(null)}
          role="tabpanel"
        >
          <SmartImage
            key={active.url}
            src={active.url}
            alt={active.alt}
            sizes="(min-width: 1280px) 50vw, 55vw"
            maxWidth={1920}
            priority
            wrapperClassName="absolute inset-0 animate-fade-in"
            className="transition-transform duration-200 ease-out"
            style={zoom ? { transform: 'scale(2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
          <span className="pointer-events-none absolute bottom-4 end-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink opacity-100 transition-opacity group-hover:opacity-0" aria-hidden>
            <ZoomIn className="h-4 w-4" />
          </span>
        </div>
      </div>

      {badges && <div className="pointer-events-none absolute start-4 top-4 flex flex-col items-start gap-1.5 lg:start-[92px] xl:start-[104px]">{badges}</div>}
    </div>
  );
}
