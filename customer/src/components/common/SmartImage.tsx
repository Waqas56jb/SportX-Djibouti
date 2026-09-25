import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

const WIDTHS = [320, 480, 640, 800, 1080, 1440, 1920];

/** Builds a responsive srcset for CDN URLs that accept a `w` parameter. */
function buildSrcSet(src: string, max: number) {
  if (!src.includes('images.unsplash.com')) return undefined;
  return WIDTHS.filter((w) => w <= max)
    .map((w) => `${src}${src.includes('?') ? '&' : '?'}w=${w} ${w}w`)
    .join(', ');
}

const sized = (src: string, w: number) => (src.includes('images.unsplash.com') ? `${src}${src.includes('?') ? '&' : '?'}w=${w}` : src);

interface SmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  alt: string;
  /** Responsive `sizes` hint — e.g. "(min-width: 1024px) 25vw, 50vw". */
  sizes?: string;
  /** Largest rendition to offer in srcset. */
  maxWidth?: number;
  priority?: boolean;
  wrapperClassName?: string;
}

/**
 * Lazy, responsive image with a neutral placeholder, fade-in on load and a
 * branded fallback if the source fails — the UI never shows a broken image.
 */
export function SmartImage({
  src,
  alt,
  sizes = '100vw',
  maxWidth = 1440,
  priority = false,
  className,
  wrapperClassName,
  ...rest
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // `relative` would override a caller's `absolute`/`fixed` (Tailwind emits it later), so only add it when unpositioned.
  const positioned = /(^|\s)(absolute|fixed|sticky)(\s|$)/.test(wrapperClassName ?? '');

  return (
    <div className={cn(!positioned && 'relative', 'overflow-hidden bg-paper-200', wrapperClassName)}>
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-paper-200" role="img" aria-label={alt}>
          <span className="font-display text-2xl font-extrabold tracking-tight text-ink/15">SPORTX</span>
        </div>
      ) : (
        <img
          src={sized(src, Math.min(maxWidth, 1080))}
          srcSet={buildSrcSet(src, maxWidth)}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          // fetchpriority is valid HTML; React 18 passes it through lowercase.
          {...(priority ? { fetchpriority: 'high' } : {})}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn('h-full w-full object-cover transition-opacity duration-500 ease-out', loaded ? 'opacity-100' : 'opacity-0', className)}
          {...rest}
        />
      )}
    </div>
  );
}
