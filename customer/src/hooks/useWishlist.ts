import { useCallback, useMemo } from 'react';
import { toast } from '@/store/toastStore';
import { useWishlistStore } from '@/store/wishlistStore';
import type { Product } from '@/types';

export function useWishlist() {
  const items = useWishlistStore((s) => s.items);
  const ids = useMemo(() => new Set(items.map((i) => i.productId)), [items]);

  const toggle = useCallback((product: Pick<Product, 'id' | 'name' | 'images'>) => {
    const added = useWishlistStore.getState().toggle(product.id);
    if (added) {
      toast.success('Saved to wishlist', { description: product.name, image: product.images[0]?.url });
    } else {
      toast.info('Removed from wishlist', {
        description: product.name,
        action: { label: 'Undo', onClick: () => useWishlistStore.getState().toggle(product.id) },
      });
    }
    return added;
  }, []);

  return {
    items,
    productIds: items.map((i) => i.productId),
    count: items.length,
    has: (id: string) => ids.has(id),
    toggle,
    remove: useWishlistStore.getState().remove,
  };
}
