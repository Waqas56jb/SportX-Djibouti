import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { wishlistService } from '@/services';
import { useWishlistStore } from '@/store/wishlistStore';

/**
 * Keeps the on-device wishlist and the account wishlist in step:
 * merges both on sign-in, then saves changes while signed in.
 */
export function WishlistSync() {
  const { user } = useAuth();
  const items = useWishlistStore((s) => s.items);
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      synced.current = null;
      return;
    }
    if (synced.current === user.id) return;
    synced.current = user.id;
    const local = useWishlistStore.getState().items.map((i) => i.productId);
    wishlistService
      .sync(user.id, local)
      .then((merged) => useWishlistStore.getState().replace(merged))
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user || synced.current !== user.id) return;
    wishlistService.save(user.id, items.map((i) => i.productId)).catch(() => undefined);
  }, [items, user]);

  return null;
}
