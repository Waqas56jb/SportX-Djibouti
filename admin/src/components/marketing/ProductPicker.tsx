import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { ProductListItem } from '@/types';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/format';
import { ProductThumb, Segmented } from '@/components/common';
import { SearchInput } from '@/components/forms';
import { mainImage } from './useMarketingData';

/** Searchable product list with thumbnails and sale-price preview. */
export function ProductPicker({ products, value, onChange, discountPercent, error, loading }: { products: ProductListItem[]; value: string[]; onChange: (ids: string[]) => void; discountPercent?: number; error?: string; loading?: boolean }) {
  const [q, setQ] = useState('');
  const [view, setView] = useState<'all' | 'selected'>('all');
  const selected = useMemo(() => new Set(value), [value]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products
      .filter((p) => view === 'all' || selected.has(p.id))
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.brandName.toLowerCase().includes(s))
      .slice(0, 80);
  }, [products, q, view, selected]);
  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  const pct = discountPercent && discountPercent > 0 && discountPercent <= 90 ? discountPercent : 0;

  return (
    <fieldset>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <legend className="text-[0.8125rem] font-medium text-zinc-800">
          Products<span className="ml-0.5 text-red-600" aria-hidden>*</span>
        </legend>
        <span className="text-xs tabular text-zinc-500">{value.length} selected</span>
      </div>
      <div className={cn('overflow-hidden rounded-xl border', error ? 'border-red-400' : 'border-zinc-200')}>
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-zinc-50/70 p-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search name, SKU or brand…" className="min-w-0 flex-1" label="Search products" />
          <Segmented size="xs" ariaLabel="Show" value={view} onChange={setView} options={[{ value: 'all', label: 'All' }, { value: 'selected', label: `Selected (${value.length})` }]} />
        </div>
        <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto scrollbar-thin" aria-label="Products" aria-multiselectable role="listbox">
          {loading && <li className="px-4 py-8 text-center text-[0.8125rem] text-zinc-500">Loading products…</li>}
          {!loading && list.length === 0 && <li className="px-4 py-8 text-center text-[0.8125rem] text-zinc-500">{view === 'selected' ? 'No products selected yet.' : 'No products match your search.'}</li>}
          {list.map((p) => {
            const on = selected.has(p.id);
            return (
              <li key={p.id}>
                <button type="button" role="option" aria-selected={on} onClick={() => toggle(p.id)} className={cn('flex w-full items-center gap-3 px-3 py-2 text-left transition-colors', on ? 'bg-zinc-50' : 'hover:bg-zinc-50')}>
                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-ink-950 bg-ink-950 text-white' : 'border-zinc-300 bg-white')}>{on && <Check size={11} strokeWidth={3} aria-hidden />}</span>
                  <ProductThumb src={mainImage(p)} alt={p.name} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium text-zinc-900">{p.name}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {p.brandName} · {p.sku} · {p.totalStock} in stock
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular">
                    {pct ? (
                      <>
                        <span className="block font-semibold text-zinc-950">{formatMoney(Math.round(p.price * (1 - pct / 100)))}</span>
                        <span className="block text-zinc-400 line-through">{formatMoney(p.price)}</span>
                      </>
                    ) : (
                      <span className="font-medium text-zinc-700">{formatMoney(p.price)}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{error}</p>}
    </fieldset>
  );
}

/** Overlapping product thumbnails with a "+n" chip. */
export function ThumbStack({ products, max = 5 }: { products: ProductListItem[]; max?: number }) {
  const shown = products.slice(0, max);
  const extra = products.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((p) => (
        <ProductThumb key={p.id} src={mainImage(p)} alt={p.name} size={32} className="ring-2 ring-white" />
      ))}
      {extra > 0 && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-2xs font-semibold text-zinc-600 ring-2 ring-white">+{extra}</span>}
    </div>
  );
}
