import { useState } from 'react';
import { Boxes } from 'lucide-react';
import type { ProductVariant, StockStatus } from '@/types';
import { Button, ColorDot, StatusBadge } from '@/components/common';
import { FormSection, NumberInput } from '@/components/forms';
import { STOCK_STATUS } from '@/constants/status';
import { productStockStatus, totalStock, variantStockStatus } from '@/utils/stock';
import { formatNumber } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

const BAR: Record<StockStatus, string> = { in_stock: 'bg-emerald-500', low_stock: 'bg-amber-500', out_of_stock: 'bg-red-500' };

export function InventorySection({ variants, update }: { variants: ProductVariant[]; update: (fn: (prev: ProductVariant[]) => ProductVariant[]) => void }) {
  const [threshold, setThreshold] = useState<number | ''>(3);
  const status = productStockStatus(variants);
  const total = totalStock(variants);
  const reserved = variants.reduce((s, v) => s + v.reserved, 0);
  const max = Math.max(1, ...variants.map((v) => v.stock));
  const counts = variants.reduce<Record<StockStatus, number>>(
    (acc, v) => {
      acc[variantStockStatus(v)]++;
      return acc;
    },
    { in_stock: 0, low_stock: 0, out_of_stock: 0 },
  );

  return (
    <FormSection id="inventory" title="Inventory" description="Stock is tracked per variant. Adjustments after creation are logged in Stock movements.">
      {variants.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-zinc-50 px-4 py-5 text-[0.8125rem] text-zinc-500">
          <Boxes size={18} className="text-zinc-400" aria-hidden /> Add variants to manage stock.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 p-4 sm:col-span-1">
              <div className="text-xs font-medium text-zinc-500">Product status</div>
              <div className="mt-2">
                <StatusBadge map={STOCK_STATUS} value={status} size="md" />
              </div>
            </div>
            <Kpi label="On hand" value={total} />
            <Kpi label="Reserved" value={reserved} />
            <Kpi label="Available" value={Math.max(0, total - reserved)} />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {(Object.keys(counts) as StockStatus[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-700">
                <span className={cn('h-2 w-2 rounded-full', BAR[k])} aria-hidden /> {counts[k]} {STOCK_STATUS[k].label.toLowerCase()}
              </span>
            ))}
          </div>

          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200" aria-label="Stock by variant">
            {variants.map((v) => {
              const s = variantStockStatus(v);
              return (
                <li key={v.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)_120px]">
                  <span className="flex min-w-0 items-center gap-2 text-[0.8125rem] font-medium text-zinc-800">
                    <ColorDot hex={v.colorHex} /> <span className="truncate">{v.color} / {v.size}</span>
                  </span>
                  <span className="order-3 col-span-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 sm:order-none sm:col-span-1" aria-hidden>
                    <span className={cn('block h-full rounded-full', BAR[s])} style={{ width: `${Math.max(2, (v.stock / max) * 100)}%` }} />
                  </span>
                  <span className="text-right text-[0.8125rem] tabular text-zinc-700">
                    <span className="font-semibold text-zinc-950">{formatNumber(v.stock)}</span> <span className="text-zinc-400">/ low at {v.lowStockThreshold}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-end gap-3 rounded-xl bg-zinc-50 p-4">
            <NumberInput label="Default low-stock threshold" value={threshold} min={0} onValueChange={setThreshold} className="w-56" help="Alert when a variant drops to this level." />
            <Button
              className="mb-6"
              disabled={threshold === ''}
              onClick={() => {
                const t = threshold === '' ? 0 : threshold;
                update((list) => list.map((v) => ({ ...v, lowStockThreshold: t })));
                toast.success(`Threshold set to ${t} for ${variants.length} variants.`);
              }}
            >
              Apply to all variants
            </Button>
          </div>
        </>
      )}
    </FormSection>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular text-zinc-950">{formatNumber(value)}</div>
    </div>
  );
}
