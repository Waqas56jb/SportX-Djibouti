import { CurrencyInput, FormGrid, FormSection, NumberInput } from '@/components/forms';
import { formatMoney, getActiveCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { FormErrors, ProductDraft, SetDraft } from './model';

export function PricingSection({ draft, set, errors }: { draft: ProductDraft; set: SetDraft; errors: FormErrors }) {
  const price = draft.price === '' ? 0 : draft.price;
  const compare = draft.compareAtPrice === '' ? 0 : draft.compareAtPrice;
  const cost = draft.costPrice === '' ? undefined : draft.costPrice;
  const tax = draft.taxRate === '' ? 0 : draft.taxRate;
  const onSale = compare > price && price > 0;
  const discount = onSale ? Math.round(((compare - price) / compare) * 100) : 0;
  const profit = cost !== undefined && price > 0 ? price - cost : undefined;
  const margin = profit !== undefined && price > 0 ? (profit / price) * 100 : undefined;
  const taxIncluded = price > 0 ? price - price / (1 + tax / 100) : 0;
  const round = (n: number) => (getActiveCurrency() === 'DJF' ? Math.round(n / 50) * 50 : Math.round(n * 100) / 100);

  /** Applies a markdown: keeps (or sets) the compare-at price and derives the sale price from it. */
  const applyDiscount = (v: number | '') => {
    if (v === '' || v <= 0) {
      if (onSale) {
        set('price', compare);
        set('compareAtPrice', '');
      }
      return;
    }
    const pct = Math.min(v, 95);
    const base = onSale ? compare : price;
    if (!base) return;
    set('compareAtPrice', base);
    set('price', round(base * (1 - pct / 100)));
  };

  return (
    <FormSection id="pricing" title="Pricing" description={`Amounts are in ${getActiveCurrency()} (store currency, set in Settings).`}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <FormGrid>
            <CurrencyInput label="Price" required value={draft.price} error={errors.price} onValueChange={(v) => set('price', v)} help="What the customer pays." />
            <CurrencyInput label="Compare-at price" optional value={draft.compareAtPrice} error={errors.compareAtPrice} onValueChange={(v) => set('compareAtPrice', v)} help="Original price, shown struck through." />
          </FormGrid>
          <FormGrid cols={3}>
            <CurrencyInput label="Cost price" optional value={draft.costPrice} error={errors.costPrice} onValueChange={(v) => set('costPrice', v)} help="Internal only." />
            <NumberInput label="Tax" value={draft.taxRate} min={0} max={100} step={0.5} suffix="%" error={errors.taxRate} onValueChange={(v) => set('taxRate', v)} help="Included in price." />
            <NumberInput label="Discount" optional value={discount || ''} min={0} max={95} suffix="%" onValueChange={applyDiscount} help="Sets price from compare-at." />
          </FormGrid>
        </div>

        <aside aria-label="Price preview" className="overflow-hidden rounded-xl bg-ink-950 text-white">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Live preview</span>
            {onSale && <span className="rounded bg-volt px-1.5 py-0.5 text-[11px] font-bold text-ink-950">−{discount}%</span>}
          </div>
          <div className="px-4 py-4">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold tabular tracking-tight">{price ? formatMoney(price) : '—'}</span>
            </div>
            {onSale && <div className="mt-0.5 text-sm text-zinc-500 line-through tabular">{formatMoney(compare)}</div>}
          </div>
          <dl className="space-y-2 border-t border-white/10 px-4 py-4 text-[0.8125rem]">
            <Row label="Original price" value={compare || price ? formatMoney(onSale ? compare : price) : '—'} />
            <Row label="Sale price" value={onSale ? formatMoney(price) : 'No sale'} />
            <Row label="Discount" value={onSale ? `${discount}%` : '—'} />
            <Row label={`Tax included (${tax}%)`} value={price ? formatMoney(taxIncluded) : '—'} />
            <Row label="Profit per unit" value={profit !== undefined ? formatMoney(profit) : 'Add cost price'} tone={profit !== undefined ? (profit < 0 ? 'bad' : 'good') : undefined} />
            <Row label="Margin" value={margin !== undefined ? `${margin.toFixed(1)}%` : '—'} tone={margin !== undefined ? (margin < 15 ? 'bad' : 'good') : undefined} />
          </dl>
        </aside>
      </div>
    </FormSection>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-zinc-400">{label}</dt>
      <dd className={cn('font-medium tabular', tone === 'good' && 'text-volt', tone === 'bad' && 'text-red-400', !tone && 'text-zinc-100')}>{value}</dd>
    </div>
  );
}
