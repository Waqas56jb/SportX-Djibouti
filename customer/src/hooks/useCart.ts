import { useCallback, useMemo } from 'react';
import { selectCartCount, selectCartItems, useCartStore } from '@/store/cartStore';
import { toast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import type { CartItem, Product } from '@/types';
import { estimateTotals } from '@/utils/cart';
import { findVariant, imageForColor, requiresSizeSelection } from '@/utils/product';
import { useStoreSettings } from './useStoreSettings';

export interface AddToCartOptions {
  color?: string;
  size?: string;
  quantity?: number;
  /** Open the cart drawer after adding (default true). */
  openDrawer?: boolean;
  silent?: boolean;
}

export type AddToCartError = 'color' | 'size' | 'stock' | 'limit' | 'details';

/**
 * Bag facade for components. Signed-in: lines/issues/totals come from the server cart.
 * Guest: the on-device bag with an estimated subtotal (shipping, coupons and tax at checkout).
 */
export function useCart() {
  const mode = useCartStore((s) => s.mode);
  const server = useCartStore((s) => s.server);
  const local = useCartStore((s) => s.local);
  const items = useCartStore(selectCartItems);
  const count = useCartStore(selectCartCount);
  const syncing = useCartStore((s) => s.syncing);
  const pending = useCartStore((s) => s.pending);
  const issues = useCartStore((s) => s.issues);
  const syncError = useCartStore((s) => s.syncError);
  const store = useCartStore;
  const openOverlay = useUiStore((s) => s.open);
  const settings = useStoreSettings();

  const isAccount = mode === 'account';
  const totals = useMemo(
    () => (isAccount && server ? server.totals : estimateTotals(local, settings?.freeShippingThreshold)),
    [isAccount, server, local, settings?.freeShippingThreshold],
  );
  const coupon = isAccount ? (server?.coupon ?? null) : null;

  /**
   * Validates colour, size and stock, then adds. Resolves with the failing field so the caller
   * can highlight it, or null on success. Summary products (no variants) must be opened first.
   */
  const addProduct = useCallback(
    async (product: Product, { color, size, quantity = 1, openDrawer = true, silent = false }: AddToCartOptions = {}): Promise<AddToCartError | null> => {
      if (!product.variants.length) return 'details';
      const chosenColor = color ?? (product.colors.length === 1 ? product.colors[0].name : undefined);
      const chosenSize = size ?? (!requiresSizeSelection(product) ? product.sizes[0] : undefined);

      if (!chosenColor) {
        toast.error('Select a colour', { description: 'Choose a colour before adding to your bag.' });
        return 'color';
      }
      if (!chosenSize) {
        toast.error('Select a size', { description: 'Choose your size before adding to your bag.' });
        return 'size';
      }
      const variant = findVariant(product, chosenColor, chosenSize);
      if (!variant || variant.stock <= 0) {
        toast.error('Out of stock', { description: `${product.name} in ${chosenColor} / ${chosenSize} is sold out.` });
        return 'stock';
      }

      const unitPrice = variant.price ?? product.price;
      const line: CartItem = {
        id: variant.id,
        productId: product.id,
        variantId: variant.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        image: imageForColor(product, chosenColor)?.url ?? '',
        color: chosenColor,
        size: chosenSize,
        unitPrice,
        compareAtPrice: variant.compareAtPrice ?? product.compareAtPrice,
        quantity,
        maxStock: variant.stock,
      };
      const result = await store.getState().add(line);
      if (!result.ok) {
        toast.error('Couldn’t add to bag', { description: result.reason });
        return 'limit';
      }
      if (!silent) {
        if (openDrawer) openOverlay('cart');
        else {
          toast.success('Added to bag', {
            description: `${product.name} · ${chosenColor} · ${chosenSize}`,
            image: line.image,
            action: { label: 'View bag', onClick: () => openOverlay('cart') },
          });
        }
      }
      return null;
    },
    [openOverlay, store],
  );

  const setQuantity = useCallback(
    (id: string, quantity: number) => {
      const item = selectCartItems(store.getState()).find((i) => i.id === id);
      if (!item) return;
      if (quantity > item.maxStock) {
        toast.info(`Only ${item.maxStock} available`, { description: `We have ${item.maxStock} of this size in stock.` });
      }
      void store.getState().setQuantity(id, Math.min(quantity, Math.max(item.maxStock, 1)));
    },
    [store],
  );

  const remove = useCallback(
    (id: string) => {
      const item = selectCartItems(store.getState()).find((i) => i.id === id);
      if (!item) return;
      void store.getState().remove(id);
      toast.info('Removed from bag', {
        description: item.name,
        action: {
          label: 'Undo',
          onClick: () => void store.getState().add({ ...item, id: item.variantId }),
        },
      });
    },
    [store],
  );

  return {
    items,
    coupon,
    count,
    totals,
    issues,
    isAccount,
    /** Loading / merging the account bag. */
    syncing,
    pending,
    syncError,
    isEmpty: items.length === 0,
    addProduct,
    setQuantity,
    remove,
    clear: store.getState().clear,
    clearLocal: store.getState().clearLocal,
    applyCoupon: store.getState().applyCoupon,
    removeCoupon: store.getState().removeCoupon,
    refresh: store.getState().refresh,
    dismissIssues: store.getState().dismissIssues,
  };
}
