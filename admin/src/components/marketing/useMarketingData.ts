import { useEffect, useMemo, useState } from 'react';
import type { MarketingBrand, MarketingCategory, MarketingProduct } from '@/types';
import type { SelectOption } from '@/components/forms';
import { useAsync } from '@/hooks/useAsync';
import { discountService } from '@/services/discountService';

export interface MarketingCatalog {
  products: MarketingProduct[];
  categories: MarketingCategory[];
  brands: MarketingBrand[];
  productOptions: SelectOption[];
  categoryOptions: SelectOption[];
  brandOptions: SelectOption[];
  productById: Map<string, MarketingProduct>;
  categoryById: Map<string, MarketingCategory>;
  brandById: Map<string, MarketingBrand>;
  loading: boolean;
}

/** Catalogue lookups used by coupon, discount, flash sale and campaign editors. Loaded once per page. */
export function useMarketingCatalog(): MarketingCatalog {
  const { data, loading } = useAsync(() => discountService.getMarketingCatalog(), []);
  return useMemo(() => {
    const { products = [], categories = [], brands = [] } = data ?? {};
    const byId = new Map(categories.map((c) => [c.id, c]));
    return {
      products,
      categories,
      brands,
      productOptions: products.map((p) => ({ value: p.id, label: p.sku ? `${p.name} · ${p.sku}` : p.name })),
      categoryOptions: categories.map((c) => {
        const parent = c.parentId ? byId.get(c.parentId)?.name : undefined;
        return { value: c.id, label: parent ? `${parent} › ${c.name}` : c.name };
      }),
      brandOptions: brands.map((b) => ({ value: b.id, label: b.name })),
      productById: new Map(products.map((p) => [p.id, p])),
      categoryById: byId,
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

export const mainImage = (p?: Pick<MarketingProduct, 'image'>) => p?.image;
