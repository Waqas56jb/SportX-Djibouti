import { useCallback, useMemo } from 'react';
import { selectCartCount, useCartStore } from '@/store/cartStore';
import { toast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import type { CartItem, Product } from '@/types';
import { calculateTotals } from '@/utils/cart';
import { findVariant, imageForColor, requiresSizeSelection } from '@/utils/product';

export interface AddToCartOptions {
  color?: string;
  size?: string;
  quantity?: number;
  /** Open the cart drawer after adding (default true). */
  openDrawer?: boolean;
  silent?: boolean;
}

export type AddToCartError = 'color' | 'size' | 'stock' | 'limit';

export function useCart() {
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const count = useCartStore(selectCartCount);
  const store = useCartStore;
  const openOverlay = useUiStore((s) => s.open);

  const totals = useMemo(() => calculateTotals(items, coupon), [items, coupon]);

  /**
   * Validates colour, size and stock before adding. Returns the failing
   * field so the caller can highlight it, or null on success.
   */
  const addProduct = useCallback(
    (product: Product, { color, size, quantity = 1, openDrawer = true, silent = false }: AddToCartOptions = {}): AddToCartError | null => {
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

      const line: CartItem = {
        id: variant.id,
        productId: product.id,
        variantId: variant.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        image: imageForColor(product, chosenColor).url,
        color: chosenColor,
        size: chosenSize,
        unitPrice: product.price,
        compareAtPrice: product.compareAtPrice,
        quantity,
        maxStock: variant.stock,
      };
      const result = store.getState().add(line);
      if (!result.ok) {
        toast.error('Quantity limit reached', { description: result.reason });
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
      const item = store.getState().items.find((i) => i.id === id);
      if (!item) return;
      if (quantity > item.maxStock) {
        toast.info(`Only ${item.maxStock} available`, { description: `We have ${item.maxStock} of this size in stock.` });
      }
      store.getState().setQuantity(id, quantity);
    },
    [store],
  );

  const remove = useCallback(
    (id: string) => {
      const item = store.getState().items.find((i) => i.id === id);
      if (!item) return;
      store.getState().remove(id);
      toast.info('Removed from bag', {
        description: item.name,
        action: { label: 'Undo', onClick: () => store.getState().add(item) },
      });
    },
    [store],
  );

  return {
    items,
    coupon,
    count,
    totals,
    isEmpty: items.length === 0,
    addProduct,
    setQuantity,
    remove,
    clear: store.getState().clear,
    setCoupon: store.getState().setCoupon,
    reconcile: store.getState().reconcile,
  };
}
