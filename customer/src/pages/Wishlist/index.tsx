import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { AccountSection } from '@/components/account/AccountLayout';
import { Breadcrumbs, Button, ButtonLink, EmptyState, ErrorState, InlineAlert, Price, SmartImage } from '@/components/common';
import { ProductGridSkeleton } from '@/components/product';
import { ROUTES, productPath } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useProductsByIds } from '@/hooks/useProducts';
import { useWishlist } from '@/hooks/useWishlist';
import { categoryLabel } from '@/services/productService';
import { useUiStore } from '@/store/uiStore';
import type { Product } from '@/types';
import { formatDate, pluralize } from '@/utils/format';
import { firstAvailableColor, requiresSizeSelection, stockState } from '@/utils/product';

function WishlistItem({ product, addedAt }: { product: Product; addedAt?: string }) {
  const { remove } = useWishlist();
  const { addProduct } = useCart();
  const openQuickView = useUiStore((s) => s.openQuickView);
  const state = product.stockStatus === 'OUT_OF_STOCK' ? 'out-of-stock' : product.stockStatus === 'LOW_STOCK' ? 'low-stock' : product.stockStatus ? 'in-stock' : stockState(product.stock);

  const add = () => {
    if (!product.variants.length || requiresSizeSelection(product) || product.colors.length > 1) openQuickView(product.slug);
    else void addProduct(product, { color: firstAvailableColor(product) });
  };

  return (
    <li className="group flex flex-col">
      <Link to={productPath(product.slug)} className="relative block aspect-[4/5] overflow-hidden bg-paper-100">
        <SmartImage src={product.images[0]?.url ?? ''} alt={product.images[0]?.alt ?? product.name} sizes="(min-width: 1024px) 25vw, 50vw" wrapperClassName="absolute inset-0" className="transition-transform duration-700 ease-premium group-hover:scale-105" />
      </Link>
      <button
        type="button"
        onClick={() => remove(product.id)}
        className="-mt-12 mr-2 flex h-10 w-10 items-center justify-center self-end rounded-full bg-white/90 text-ink hover:text-danger"
        aria-label={`Remove ${product.name} from wishlist`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <div className="mt-3 flex flex-1 flex-col">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-500">{categoryLabel(product)}</p>
        <Link to={productPath(product.slug)} className="mt-1 text-[15px] font-semibold leading-snug hover:underline">
          {product.name}
        </Link>
        <Price price={product.price} compareAtPrice={product.compareAtPrice} className="mt-2" />
        <p className={state === 'out-of-stock' ? 'mt-1 text-xs text-danger' : state === 'low-stock' ? 'mt-1 text-xs text-warning' : 'mt-1 text-xs text-success'}>
          {state === 'out-of-stock' ? 'Out of stock' : state === 'low-stock' ? `Only ${product.stock} left` : 'In stock'}
        </p>
        {addedAt && <p className="mt-0.5 text-xs text-ink-500">Saved {formatDate(addedAt)}</p>}
        <Button variant={state === 'out-of-stock' ? 'outline' : 'primary'} size="sm" className="mt-4" onClick={add} disabled={state === 'out-of-stock'} leftIcon={<ShoppingBag className="h-4 w-4" />}>
          {state === 'out-of-stock' ? 'Sold out' : 'Add to bag'}
        </Button>
      </div>
    </li>
  );
}

function WishlistContent() {
  const { items, productIds } = useWishlist();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const { data, loading, error, reload } = useProductsByIds(productIds);

  if (!items.length) {
    return (
      <EmptyState
        icon={<Heart />}
        title="Your wishlist is empty"
        description="Tap the heart on any product to save it here for later."
        action={
          <ButtonLink to={ROUTES.newArrivals} variant="primary">
            Discover new arrivals
          </ButtonLink>
        }
      />
    );
  }

  return (
    <>
      {!isAuthenticated && (
        <InlineAlert className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>Your wishlist is saved on this device. Sign in to keep it across devices.</span>
          <Link to={`${ROUTES.login}?redirect=${encodeURIComponent(location.pathname)}`} className="shrink-0 font-semibold underline underline-offset-4">
            Sign in
          </Link>
        </InlineAlert>
      )}
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <ProductGridSkeleton count={Math.min(items.length, 8)} />
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
          {(data ?? []).map((p) => (
            <WishlistItem key={p.id} product={p} addedAt={items.find((i) => i.productId === p.id)?.addedAt} />
          ))}
        </ul>
      )}
    </>
  );
}

/** Public wishlist route (/wishlist). */
export default function WishlistPage() {
  usePageMeta({ title: 'Wishlist', noindex: true });
  const { count } = useWishlist();
  return (
    <div className="container-site pb-24 pt-8 sm:pt-10">
      <Breadcrumbs items={[{ label: 'Wishlist' }]} />
      <div className="mb-10 mt-6 flex items-end justify-between gap-4">
        <h1 className="heading-xl">Wishlist</h1>
        {count > 0 && <p className="pb-1 text-sm text-ink-500">{pluralize(count, 'item')}</p>}
      </div>
      <WishlistContent />
    </div>
  );
}

/** Account wishlist route (/account/wishlist). */
export function AccountWishlistPage() {
  usePageMeta({ title: 'Wishlist', noindex: true });
  const { count } = useWishlist();
  return (
    <AccountSection title="Wishlist" description={count ? `${pluralize(count, 'saved item')}` : undefined}>
      <WishlistContent />
    </AccountSection>
  );
}
