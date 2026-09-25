import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageCheck } from 'lucide-react';
import type { InventoryItem } from '@/types';
import { inventoryService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { usePermission } from '@/hooks/usePermission';
import { Button, ColorDot, EmptyState, ErrorState, Panel, ProductThumb, Skeleton, StatusBadge } from '@/components/common';
import { StockAdjustmentDrawer } from '@/components/inventory/StockAdjustmentDrawer';
import { STOCK_STATUS } from '@/constants/status';
import { formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

export function LowStockPanel() {
  const { data, loading, error, reload } = useAsync(() => inventoryService.getLowStock(6), []);
  const canAdjust = usePermission('inventory:edit');
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  return (
    <Panel
      flush
      title="Low stock"
      description="Current stock / threshold · most urgent first"
      actions={
        <Link to="/inventory?status=low_stock" className="text-xs font-semibold text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline">
          View inventory
        </Link>
      }
      className="xl:col-span-2"
    >
      {error ? (
        <ErrorState compact onRetry={() => void reload()} description="We couldn’t load low-stock items. Please try again." />
      ) : loading || !data ? (
        <ul aria-busy="true" aria-label="Loading low stock">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3 last:border-0">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-7 w-20" />
            </li>
          ))}
        </ul>
      ) : data.length === 0 ? (
        <EmptyState compact icon={PackageCheck} title="Stock levels look healthy" description="No variants are at or below their low-stock threshold." />
      ) : (
        <ul>
          {data.map((i) => (
            <li key={i.variantId} className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3 last:border-0">
              <ProductThumb src={i.productImage} alt={i.productName} size={40} />
              <div className="min-w-0 flex-1">
                <Link to={`/products/${i.productId}`} className="block truncate text-[0.8125rem] font-semibold text-zinc-900 hover:underline">
                  {i.productName}
                </Link>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                  <ColorDot hex={i.colorHex} size={10} />
                  <span className="truncate">{i.variantLabel}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[0.8125rem] tabular">
                  <span className={cn('font-display text-lg font-bold leading-none', i.stock === 0 ? 'text-red-600' : 'text-zinc-950')}>{formatNumber(i.stock)}</span>
                  <span className="text-zinc-400"> / {formatNumber(i.threshold)}</span>
                </div>
                <div className="mt-1">
                  <StatusBadge map={STOCK_STATUS} value={i.status} />
                </div>
              </div>
              {canAdjust && (
                <Button size="xs" variant="secondary" onClick={() => setEditing(i)} aria-label={`Update stock for ${i.productName}, ${i.variantLabel}`} className="shrink-0">
                  UPDATE STOCK
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <StockAdjustmentDrawer open={Boolean(editing)} item={editing} onClose={() => setEditing(null)} onSaved={() => void reload(true)} />
    </Panel>
  );
}
