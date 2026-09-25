import { useCallback } from 'react';
import { errorMessage } from '@/services';
import { orderService } from '@/services/orderService';
import { productService } from '@/services/productService';
import { useCartStore } from '@/store/cartStore';
import { toast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import type { Order, Product } from '@/types';
import { imageForColor } from '@/utils/product';

/** Adds every still-available line of a past order back to the bag (stock and prices re-checked live). */
export function useReorder() {
  const open = useUiStore((s) => s.open);
  return useCallback(
    async (input: Order) => {
      try {
        const order = input.isSummary || !input.items.length ? ((await orderService.getById(input.id)) ?? input) : input;
        const slugs = [...new Set(order.items.map((i) => i.slug).filter(Boolean))];
        const products = (await Promise.all(slugs.map((s) => productService.getBySlug(s).catch(() => null)))).filter((p): p is Product => Boolean(p));
        let added = 0;
        const skipped: string[] = [];
        for (const item of order.items) {
          const product = products.find((p) => p.id === item.productId);
          const variant = product?.variants.find((v) => v.id === item.variantId);
          if (!product || !variant || variant.stock <= 0) {
            skipped.push(item.name);
            continue;
          }
          const result = await useCartStore.getState().add({
            id: variant.id,
            productId: product.id,
            variantId: variant.id,
            slug: product.slug,
            name: product.name,
            brand: product.brand,
            image: imageForColor(product, variant.color)?.url ?? item.image,
            color: variant.color,
            size: variant.size,
            unitPrice: variant.price ?? product.price,
            compareAtPrice: variant.compareAtPrice ?? product.compareAtPrice,
            quantity: Math.min(item.quantity, variant.stock),
            maxStock: variant.stock,
          });
          if (result.ok) added++;
          else skipped.push(item.name);
        }
        if (added) open('cart');
        if (skipped.length) {
          toast.info(added ? 'Some items are unavailable' : 'Items unavailable', {
            description: `${skipped.join(', ')} ${skipped.length > 1 ? 'are' : 'is'} no longer available in that size.`,
          });
        }
      } catch (err) {
        toast.error('Couldn’t reorder', { description: errorMessage(err) });
      }
    },
    [open],
  );
}
