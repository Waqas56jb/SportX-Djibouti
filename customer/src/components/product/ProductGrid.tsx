import { Skeleton } from '@/components/common';
import type { Product } from '@/types';
import { cn } from '@/utils/cn';
import { ProductCard } from './ProductCard';
import { t } from '@/i18n';

const COLS = {
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
} as const;

interface ProductGridProps {
  products: Product[];
  columns?: keyof typeof COLS;
  className?: string;
  /** Number of leading cards to load eagerly (above the fold). */
  priorityCount?: number;
}

export function ProductGrid({ products, columns = 4, className, priorityCount = 0 }: ProductGridProps) {
  const sizes = columns === 3 ? '(min-width: 1024px) 28vw, 50vw' : '(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw';
  return (
    <ul className={cn('grid gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12', COLS[columns], className)}>
      {products.map((p, i) => (
        <li key={p.id} className="flex">
          <ProductCard product={p} priority={i < priorityCount} sizes={sizes} className="w-full" />
        </li>
      ))}
    </ul>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="aspect-[4/5] w-full" />
      <Skeleton className="mt-4 h-3 w-1/3" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <Skeleton className="mt-2 h-3 w-1/4" />
      <Skeleton className="mt-4 h-4 w-1/3" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8, columns = 4 }: { count?: number; columns?: keyof typeof COLS }) {
  return (
    <div className={cn('grid gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12', COLS[columns])} role="status" aria-label={t('product.carousel.loading')}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
