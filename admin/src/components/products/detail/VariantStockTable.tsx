import type { ProductVariant } from '@/types';
import { ColorDot, StatusBadge } from '@/components/common';
import { STOCK_STATUS } from '@/constants/status';
import { variantStockStatus } from '@/utils/stock';
import { formatMoney, formatNumber } from '@/utils/format';

/** Read-only variants table with stock status, used on the product detail page. */
export function VariantStockTable({ variants, basePrice }: { variants: ProductVariant[]; basePrice: number }) {
  if (!variants.length) return <p className="px-5 py-8 text-center text-[0.8125rem] text-zinc-500">This product has no variants yet.</p>;
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[640px] text-left">
        <caption className="sr-only">Variants and stock</caption>
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/70 text-2xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            <th scope="col" className="py-2.5 pl-5 pr-3">Variant</th>
            <th scope="col" className="px-3 py-2.5">SKU</th>
            <th scope="col" className="px-3 py-2.5 text-right">Price</th>
            <th scope="col" className="px-3 py-2.5 text-right">Stock</th>
            <th scope="col" className="px-3 py-2.5 text-right">Reserved</th>
            <th scope="col" className="px-3 py-2.5">Barcode</th>
            <th scope="col" className="py-2.5 pl-3 pr-5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 text-[0.8125rem]">
          {variants.map((v) => (
            <tr key={v.id} className="hover:bg-zinc-50/60">
              <td className="py-2.5 pl-5 pr-3">
                <span className="inline-flex items-center gap-2 font-medium text-zinc-900">
                  <ColorDot hex={v.colorHex} /> {v.color}
                  <span className="rounded bg-zinc-100 px-1.5 py-px text-xs font-semibold tabular text-zinc-700">{v.size}</span>
                </span>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-zinc-600">{v.sku}</td>
              <td className="px-3 py-2.5 text-right tabular">
                {formatMoney(v.price ?? basePrice)}
                {v.price !== undefined && <span className="ml-1 text-2xs text-zinc-400">override</span>}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular text-zinc-900">{formatNumber(v.stock)}</td>
              <td className="px-3 py-2.5 text-right tabular text-zinc-500">{v.reserved || '—'}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">{v.barcode ?? '—'}</td>
              <td className="py-2.5 pl-3 pr-5">
                <StatusBadge map={STOCK_STATUS} value={variantStockStatus(v)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
