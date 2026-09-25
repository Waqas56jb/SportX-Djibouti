import { LOW_STOCK_THRESHOLD } from '@/constants/commerce';
import type { Product, ProductVariant, StockState } from '@/types';

export const isOnSale = (p: Pick<Product, 'price' | 'compareAtPrice'>) =>
  typeof p.compareAtPrice === 'number' && p.compareAtPrice > p.price;

export const discountPercent = (price: number, compareAtPrice?: number) =>
  compareAtPrice && compareAtPrice > price ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : 0;

export const stockState = (stock: number): StockState =>
  stock <= 0 ? 'out-of-stock' : stock <= LOW_STOCK_THRESHOLD ? 'low-stock' : 'in-stock';

export const findVariant = (product: Product, color?: string, size?: string): ProductVariant | undefined =>
  product.variants.find((v) => v.color === color && v.size === size);

/** Units available for a colour (all sizes) or a size within a colour. */
export const stockFor = (product: Product, color?: string, size?: string) =>
  product.variants
    .filter((v) => (!color || v.color === color) && (!size || v.size === size))
    .reduce((sum, v) => sum + v.stock, 0);

export const isSizeAvailable = (product: Product, color: string, size: string) => (findVariant(product, color, size)?.stock ?? 0) > 0;

export const imageForColor = (product: Product, colorName?: string) => {
  const color = product.colors.find((c) => c.name === colorName);
  return product.images[color?.imageIndex ?? 0] ?? product.images[0];
};

/** Sizes with at least one unit in stock (any colour). */
export const availableSizes = (product: Product) =>
  product.sizes.filter((size) => product.variants.some((v) => v.size === size && v.stock > 0));

export const firstAvailableColor = (product: Product) =>
  product.colors.find((c) => stockFor(product, c.name) > 0)?.name ?? product.colors[0]?.name;

/** Products with a single size need no size selection. */
export const requiresSizeSelection = (product: Product) => product.sizes.length > 1;
