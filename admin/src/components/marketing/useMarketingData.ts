import { useEffect, useMemo, useState } from 'react';
import type { Brand, Category, ProductListItem } from '@/types';
import type { SelectOption } from '@/components/forms';
import { useAsync } from '@/hooks/useAsync';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { brandService } from '@/services/brandService';

export interface MarketingCatalog {
  products: ProductListItem[];
  categories: Category[];
  brands: Brand[];
  productOptions: SelectOption[];
  categoryOptions: SelectOption[];
  brandOptions: SelectOption[];
  productById: Map<string, ProductListItem>;
  categoryById: Map<string, Category>;
  brandById: Map<string, Brand>;
  loading: boolean;
}

/** Catalogue lookups used by coupon, discount, flash sale and campaign editors. Loaded once per page. */
export function useMarketingCatalog(): MarketingCatalog {
  const { data, loading } = useAsync(() => Promise.all([productService.getProducts(), categoryService.getCategories(), brandService.getBrands()]), []);
  return useMemo(() => {
    const [products = [], categories = [], brands = []] = data ?? [];
    const parentName = (c: Category) => (c.parentId ? categories.find((p) => p.id === c.parentId)?.name : undefined);
    return {
      products,
      categories,
      brands,
      productOptions: products.map((p) => ({ value: p.id, label: `${p.name} · ${p.sku}` })),
      categoryOptions: categories.map((c) => {
        const parent = parentName(c);
        return { value: c.id, label: parent ? `${parent} › ${c.name}` : c.name };
      }),
      brandOptions: brands.map((b) => ({ value: b.id, label: b.name })),
      productById: new Map(products.map((p) => [p.id, p])),
      categoryById: new Map(categories.map((c) => [c.id, c])),
      brandById: new Map(brands.map((b) => [b.id, b])),
      loading,
    };
  }, [data, loading]);
}

/** Current timestamp that refreshes on an interval (for countdowns and "now" markers). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export const mainImage = (p?: Pick<ProductListItem, 'images'>) => p?.images.find((i) => i.role === 'main')?.url ?? p?.images[0]?.url;
