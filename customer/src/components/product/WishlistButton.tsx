import { Heart } from 'lucide-react';
import { useState } from 'react';
import { useWishlist } from '@/hooks/useWishlist';
import type { Product } from '@/types';
import { cn } from '@/utils/cn';
import { useT } from '@/i18n';

interface WishlistButtonProps {
  product: Pick<Product, 'id' | 'name' | 'images'>;
  variant?: 'floating' | 'outline';
  className?: string;
}

export function WishlistButton({ product, variant = 'floating', className }: WishlistButtonProps) {
  const { t } = useT();
  const { has, toggle } = useWishlist();
  const active = has(product.id);
  const [pop, setPop] = useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggle(product);
        if (added) setPop(true);
      }}
      aria-pressed={active}
      aria-label={active ? t('product.wishlist.remove', { name: product.name }) : t('product.wishlist.add', { name: product.name })}
      className={cn(
        'flex shrink-0 items-center justify-center transition-colors duration-200',
        variant === 'floating'
          ? 'h-10 w-10 rounded-full bg-white/90 text-ink backdrop-blur hover:bg-white'
          : 'h-14 w-14 border border-paper-300 bg-white text-ink hover:border-ink',
        className,
      )}
    >
      <Heart
        onAnimationEnd={() => setPop(false)}
        className={cn('h-[18px] w-[18px] transition-colors', active && 'fill-accent text-accent', pop && 'animate-heart-pop')}
        strokeWidth={1.75}
      />
    </button>
  );
}
