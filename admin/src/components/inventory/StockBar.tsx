import type { InventoryItem } from '@/types';
import { cn } from '@/utils/cn';
import { stockFill } from './inventoryMeta';

/** Compact stock-vs-threshold meter. The tick marks the low-stock threshold. */
export function StockBar({ item, className }: { item: Pick<InventoryItem, 'stock' | 'threshold' | 'status'>; className?: string }) {
  const fill = stockFill(item);
  const tone = item.status === 'out_of_stock' ? 'bg-red-500' : item.status === 'low_stock' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className={cn('relative h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100', className)} role="img" aria-label={`${item.stock} in stock, threshold ${item.threshold}`}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${Math.max(fill * 100, item.stock > 0 ? 4 : 0)}%` }} />
      <span className="absolute inset-y-0 left-1/2 w-px bg-zinc-400/70" aria-hidden />
    </div>
  );
}
