import { Eye, ShoppingBag } from 'lucide-react';
import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Price, Rating, SmartImage } from '@/components/common';
import { productPath } from '@/constants/routes';
import { useCart } from '@/hooks/useCart';
import { categoryLabel } from '@/services/productService';
import { useUiStore } from '@/store/uiStore';
import type { Product } from '@/types';
import { cn } from '@/utils/cn';
import { availableSizes, discountPercent, firstAvailableColor, requiresSizeSelection, stockFor, stockState } from '@/utils/product';
import { WishlistButton } from './WishlistButton';

const BADGE_LABEL: Record<NonNullable<Product['badge']>, string> = {
  new: 'New',
  bestseller: 'Best Seller',
  limited: 'Limited',
  exclusive: 'Exclusive',
};

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  sizes?: string;
  className?: string;
  tone?: 'light' | 'dark';
}

/**
 * The storefront's core merchandising unit: hover image swap, quick actions,
 * swatches, availability and pricing. Touch devices get always-visible,
 * finger-sized actions instead of hover-only controls.
 */
export const ProductCard = memo(function ProductCard({ product, priority, sizes = '(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw', className, tone = 'light' }: ProductCardProps) {
  const openQuickView = useUiStore((s) => s.openQuickView);
  const { addProduct } = useCart();
  const [activeColor, setActiveColor] = useState<string | undefined>(undefined);

  const pct = discountPercent(product.price, product.compareAtPrice);
  const hasVariants = product.variants.length > 0;
  const soldOut = product.stockStatus ? product.stockStatus === 'OUT_OF_STOCK' : product.stock <= 0;
  const state = product.stockStatus === 'LOW_STOCK' ? 'low-stock' : soldOut ? 'out-of-stock' : product.stockStatus ? 'in-stock' : stockState(product.stock);
  const sizesInStock = hasVariants ? availableSizes(product) : product.sizes;
  const colorImage = activeColor ? product.images[product.colors.find((c) => c.name === activeColor)?.imageIndex ?? 0] : undefined;
  const primary = colorImage ?? product.images[0] ?? { url: '', alt: product.name };
  const secondary = product.images.find((img) => img.url !== primary.url);
  const href = productPath(product.slug);
  const dark = tone === 'dark';

  const handleQuickAdd = () => {
    // List items carry no variant data, and sized / multi-colour items need a choice: use Quick View.
    if (!hasVariants || requiresSizeSelection(product) || product.colors.length > 1) {
      openQuickView(product.slug);
      return;
    }
    void addProduct(product, { color: firstAvailableColor(product) });
  };

  return (
    <article className={cn('group/card relative flex flex-col', className)}>
      <div className="relative overflow-hidden bg-paper-100">
        <Link to={href} className="block" tabIndex={-1} aria-hidden>
          <div className="relative aspect-[4/5]">
            <SmartImage
              src={primary.url}
              alt={primary.alt}
              sizes={sizes}
              maxWidth={1080}
              priority={priority}
              wrapperClassName="absolute inset-0"
              className={cn('transition-transform duration-700 ease-premium group-hover/card:scale-[1.04]', soldOut && 'grayscale-[40%]')}
            />
            {secondary && (
              <SmartImage
                src={secondary.url}
                alt=""
                sizes={sizes}
                maxWidth={1080}
                wrapperClassName="absolute inset-0 opacity-0 transition-opacity duration-500 ease-premium [@media(hover:hover)]:group-hover/card:opacity-100"
                className="scale-[1.04]"
              />
            )}
          </div>
        </Link>

        {/* Badges */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <Badge tone="neutral">Sold Out</Badge>
          ) : (
            <>
              {pct > 0 && <Badge tone="sale">−{pct}%</Badge>}
              {product.badge && <Badge tone={product.badge === 'limited' || product.badge === 'exclusive' ? 'dark' : 'light'}>{BADGE_LABEL[product.badge]}</Badge>}
            </>
          )}
        </div>

        <WishlistButton product={product} className="absolute right-3 top-3 z-10" />

        {/* Quick actions — hover on desktop, always reachable on touch */}
        {!soldOut && (
          <div className="absolute inset-x-3 bottom-3 z-10 hidden gap-2 [@media(hover:hover)]:flex [@media(hover:hover)]:translate-y-3 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-all [@media(hover:hover)]:duration-300 [@media(hover:hover)]:ease-premium [@media(hover:hover)]:group-hover/card:translate-y-0 [@media(hover:hover)]:group-hover/card:opacity-100 [@media(hover:hover)]:group-focus-within/card:translate-y-0 [@media(hover:hover)]:group-focus-within/card:opacity-100">
            <button type="button" onClick={handleQuickAdd} className="btn btn-sm btn-primary flex-1 min-h-[44px]">
              <ShoppingBag className="h-4 w-4" aria-hidden />
              <span>{requiresSizeSelection(product) ? 'Choose size' : 'Add to bag'}</span>
            </button>
            <button
              type="button"
              onClick={() => openQuickView(product.slug)}
              className="btn btn-sm btn-light min-h-[44px] px-3"
              aria-label={`Quick view ${product.name}`}
            >
              <Eye className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
        {!soldOut && (
          <button
            type="button"
            onClick={handleQuickAdd}
            className="absolute bottom-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-card [@media(hover:hover)]:hidden"
            aria-label={`Add ${product.name} to bag`}
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className={cn('truncate text-2xs font-semibold uppercase tracking-[0.14em]', dark ? 'text-white/60' : 'text-ink-500')}>
            {categoryLabel(product)}
          </p>
          {product.colors.length > 1 && (
            <div className="relative z-10 flex items-center gap-1" aria-label={`${product.colors.length} colours available`}>
              {product.colors.slice(0, 4).map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onMouseEnter={() => setActiveColor(c.name)}
                  onFocus={() => setActiveColor(c.name)}
                  onClick={() => setActiveColor(c.name)}
                  aria-label={`Preview ${c.name}`}
                  className={cn(
                    'relative h-3.5 w-3.5 rounded-full border transition-transform after:absolute after:-inset-2 hover:scale-125',
                    dark ? 'border-white/30' : 'border-ink/15',
                    activeColor === c.name && 'ring-1 ring-current ring-offset-1',
                    hasVariants && stockFor(product, c.name) === 0 && 'opacity-40',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {product.colors.length > 4 && <span className="text-2xs text-ink-500">+{product.colors.length - 4}</span>}
            </div>
          )}
        </div>
        <h3 className={cn('mt-1.5 font-sans text-[15px] font-semibold normal-case leading-snug', dark ? 'text-white' : 'text-ink')}>
          <Link to={href} className="line-clamp-2 after:absolute after:inset-0 after:content-[''] focus:outline-none [&:focus-visible]:underline">
            {product.name}
          </Link>
        </h3>
        <Rating value={product.rating} count={product.reviewCount} size="xs" className="mt-2" />
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <Price price={product.price} compareAtPrice={product.compareAtPrice} tone={dark ? 'light' : 'dark'} />
        </div>
        <p className={cn('mt-1.5 text-xs', soldOut ? 'text-danger' : state === 'low-stock' ? 'text-warning' : dark ? 'text-white/50' : 'text-ink-500')}>
          {soldOut
            ? 'Out of stock'
            : state === 'low-stock'
              ? `Only ${product.stock} left`
              : requiresSizeSelection(product)
                ? hasVariants
                  ? `${sizesInStock.length} of ${product.sizes.length} sizes available`
                  : `${product.sizes.length} sizes`
                : 'In stock'}
        </p>
      </div>
    </article>
  );
});
