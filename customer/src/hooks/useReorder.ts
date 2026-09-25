import { useCallback } from 'react';
import { productService } from '@/services';
import { useCartStore } from '@/store/cartStore';
import { toast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import type { Order } from '@/types';
import { imageForColor } from '@/utils/product';

/** Adds every still-available line of a past order back to the bag. */
export function useReorder() {
  const open = useUiStore((s) => s.open);
  return useCallback(
    async (order: Order) => {
      const products = await productService.getByIds([...new Set(order.items.map((i) => i.productId))]);
      let added = 0;
      const skipped: string[] = [];
      order.items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        const variant = product?.variants.find((v) => v.id === item.variantId);
        if (!product || !variant || variant.stock <= 0) {
          skipped.push(item.name);
          return;
        }
        const result = useCartStore.getState().add({
          id: variant.id,
          productId: product.id,
          variantId: variant.id,
          slug: product.slug,
          name: product.name,
          brand: product.brand,
          image: imageForColor(product, variant.color).url,
          color: variant.color,
          size: variant.size,
          unitPrice: product.price,
          compareAtPrice: product.compareAtPrice,
          quantity: Math.min(item.quantity, variant.stock),
          maxStock: variant.stock,
        });
        if (result.ok) added++;
      });
      if (added) open('cart');
      if (skipped.length) {
        toast.info(added ? 'Some items are unavailable' : 'Items unavailable', { description: `${skipped.join(', ')} ${skipped.length > 1 ? 'are' : 'is'} out of stock.` });
      }
    },
    [open],
  );
}
