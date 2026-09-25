import { useEffect, useMemo, useState } from 'react';
import { MAX_QUANTITY_PER_LINE } from '@/constants/commerce';
import { useCart } from '@/hooks/useCart';
import type { Product } from '@/types';
import { findVariant, firstAvailableColor, requiresSizeSelection, stockFor } from '@/utils/product';

/**
 * Selection state shared by the product page and Quick View:
 * colour, size, quantity, derived stock and validated add-to-cart.
 */
export function useProductSelection(product: Product | null | undefined) {
  const { addProduct } = useCart();
  const [color, setColor] = useState<string | undefined>();
  const [size, setSize] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<'size' | 'color' | null>(null);

  // Reset when the product changes.
  useEffect(() => {
    if (!product) return;
    setColor(firstAvailableColor(product));
    setSize(requiresSizeSelection(product) ? undefined : product.sizes[0]);
    setQuantity(1);
    setError(null);
  }, [product]);

  const variant = product && color && size ? findVariant(product, color, size) : undefined;
  const colorStock = product && color ? stockFor(product, color) : 0;
  const selectedStock = variant?.stock ?? (size ? 0 : colorStock);
  const maxQuantity = Math.max(1, Math.min(variant?.stock ?? MAX_QUANTITY_PER_LINE, MAX_QUANTITY_PER_LINE));
  const soldOut = (product?.stock ?? 0) <= 0;
  const variantSoldOut = Boolean(size) && selectedStock <= 0;

  // Clamp quantity when the variant's stock is lower than the current value.
  useEffect(() => {
    setQuantity((q) => Math.min(q, maxQuantity));
  }, [maxQuantity]);

  const selectColor = (name: string) => {
    setColor(name);
    setError(null);
    // Keep the size if it exists in the new colour, otherwise clear it.
    if (product && size && (findVariant(product, name, size)?.stock ?? 0) <= 0 && requiresSizeSelection(product)) setSize(undefined);
  };

  const selectSize = (value: string) => {
    setSize(value);
    setError(null);
  };

  const add = (options: { openDrawer?: boolean } = {}) => {
    if (!product) return false;
    const failure = addProduct(product, { color, size, quantity, openDrawer: options.openDrawer });
    if (failure === 'size' || failure === 'color') setError(failure);
    return failure === null;
  };

  const image = useMemo(() => {
    if (!product) return undefined;
    const idx = product.colors.find((c) => c.name === color)?.imageIndex;
    return idx;
  }, [product, color]);

  return {
    color,
    size,
    quantity,
    error,
    variant,
    selectedStock,
    maxQuantity,
    soldOut,
    variantSoldOut,
    colorImageIndex: image,
    selectColor,
    selectSize,
    setQuantity,
    add,
  };
}

export type ProductSelection = ReturnType<typeof useProductSelection>;
