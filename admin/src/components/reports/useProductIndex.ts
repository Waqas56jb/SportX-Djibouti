import { useMemo } from 'react';
import type { ProductStatus } from '@/types';
import { productService } from '@/services';
import { useAsync } from '@/hooks/useAsync';

export interface ProductIndexEntry {
  image?: string;
  status: ProductStatus;
  sport: string;
}

/**
 * Report rows (TopProduct) don't carry images or status — look them up once from the catalogue.
 * Failure is non-fatal: rows simply render without thumbnails.
 */
export function useProductIndex() {
  const { data } = useAsync(() => productService.getProducts(), []);
  return useMemo(() => {
    const map = new Map<string, ProductIndexEntry>();
    for (const p of data ?? []) {
      const main = p.images.find((i) => i.role === 'main') ?? p.images[0];
      map.set(p.id, { image: main?.url, status: p.status, sport: p.sport });
    }
    return { map, ready: Boolean(data) };
  }, [data]);
}
