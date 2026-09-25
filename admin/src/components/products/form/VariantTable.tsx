import type { InputHTMLAttributes } from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import type { ProductVariant } from '@/types';
import { ColorDot, Menu, StatusBadge } from '@/components/common';
import { STOCK_STATUS } from '@/constants/status';
import { variantStockStatus } from '@/utils/stock';
import { getActiveCurrency, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { FormErrors } from './model';

function Cell({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-8 w-full rounded-md border bg-white px-2 text-[0.8125rem] text-zinc-900 transition-colors placeholder:text-zinc-300 focus:outline-none focus:ring-2',
        invalid ? 'border-red-400 focus:ring-red-500/15' : 'border-transparent hover:border-zinc-200 focus:border-zinc-900 focus:ring-zinc-900/10',
        className,
      )}
    />
  );
}

const toInt = (v: string) => (v === '' ? 0 : Math.max(0, Math.round(Number(v))));

/** Inline-editable variants grid, grouped by colour. */
export function VariantTable({
  variants,
  errors,
  onPatch,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  variants: ProductVariant[];
  errors: FormErrors;
  onPatch: (id: string, patch: Partial<ProductVariant>) => void;
  onEdit: (v: ProductVariant) => void;
  onDuplicate: (v: ProductVariant) => void;
  onRemove: (v: ProductVariant) => void;
}) {
  const groups: { color: string; hex: string; items: ProductVariant[] }[] = [];
  for (const v of variants) {
    const g = groups.find((x) => x.color === v.color);
    if (g) g.items.push(v);
    else groups.push({ color: v.color, hex: v.colorHex, items: [v] });
  }
  const currency = getActiveCurrency();

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 scrollbar-thin">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <caption className="sr-only">Product variants</caption>
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-2xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            <th scope="col" className="py-2.5 pl-4 pr-2">Size</th>
            <th scope="col" className="px-2 py-2.5">SKU</th>
            <th scope="col" className="px-2 py-2.5">Price override ({currency})</th>
            <th scope="col" className="px-2 py-2.5">Stock</th>
            <th scope="col" className="px-2 py-2.5">Low at</th>
            <th scope="col" className="px-2 py-2.5">Barcode</th>
            <th scope="col" className="px-2 py-2.5">Status</th>
            <th scope="col" className="w-12 py-2.5 pr-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.color} className="border-b border-zinc-100 last:border-0">
            <tr className="bg-zinc-50/60">
              <th scope="rowgroup" colSpan={8} className="py-2 pl-4 text-left">
                <span className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-zinc-900">
                  <ColorDot hex={g.hex} size={14} /> {g.color}
                  <span className="font-normal text-zinc-500">
                    · {g.items.length} sizes · {formatNumber(g.items.reduce((s, v) => s + v.stock, 0))} units
                  </span>
                </span>
              </th>
            </tr>
            {g.items.map((v) => {
              const err = (f: string) => errors[`variant.${v.id}.${f}`];
              const label = `${v.color} ${v.size}`;
              return (
                <tr key={v.id} className="border-t border-zinc-100 hover:bg-zinc-50/50">
                  <td className="py-1.5 pl-4 pr-2">
                    <span className="inline-flex h-7 min-w-9 items-center justify-center rounded-md bg-zinc-100 px-2 text-[0.8125rem] font-semibold tabular text-zinc-800">{v.size}</span>
                  </td>
                  <td className="px-1 py-1.5">
                    <Cell aria-label={`SKU for ${label}`} value={v.sku} invalid={Boolean(err('sku'))} title={err('sku')} className="min-w-[170px] font-mono uppercase" onChange={(e) => onPatch(v.id, { sku: e.target.value.toUpperCase() })} />
                  </td>
                  <td className="px-1 py-1.5">
                    <Cell
                      aria-label={`Price override for ${label}`}
                      type="number"
                      min={0}
                      inputMode="decimal"
                      placeholder="Product price"
                      value={v.price ?? ''}
                      invalid={Boolean(err('price'))}
                      className="w-32 tabular"
                      onChange={(e) => onPatch(v.id, { price: e.target.value === '' ? undefined : Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Cell aria-label={`Stock for ${label}`} type="number" min={0} inputMode="numeric" value={v.stock} invalid={Boolean(err('stock'))} className="w-20 tabular" onChange={(e) => onPatch(v.id, { stock: toInt(e.target.value) })} />
                  </td>
                  <td className="px-1 py-1.5">
                    <Cell aria-label={`Low-stock threshold for ${label}`} type="number" min={0} inputMode="numeric" value={v.lowStockThreshold} className="w-16 tabular" onChange={(e) => onPatch(v.id, { lowStockThreshold: toInt(e.target.value) })} />
                  </td>
                  <td className="px-1 py-1.5">
                    <Cell aria-label={`Barcode for ${label}`} value={v.barcode ?? ''} placeholder="—" className="w-36 font-mono" onChange={(e) => onPatch(v.id, { barcode: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <StatusBadge map={STOCK_STATUS} value={variantStockStatus(v)} />
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    <Menu
                      label={`Actions for ${label}`}
                      items={[
                        { label: 'Edit', icon: Pencil, onSelect: () => onEdit(v) },
                        { label: 'Duplicate', icon: Copy, onSelect: () => onDuplicate(v) },
                        { label: 'Delete', icon: Trash2, danger: true, separator: true, onSelect: () => onRemove(v) },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
