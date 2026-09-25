import { Check, Star, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { AccordionItem, Checkbox } from '@/components/common';
import { GENDER_LABELS, SPORT_LABELS } from '@/constants/labels';
import type { CatalogParams, MultiFilterKey } from '@/hooks/useCatalogParams';
import type { FacetOption, ProductFacets } from '@/types';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';
import { t, tDynamic } from '@/i18n';

/** Category facet names come from the API in English: prefer the translated collection title. */
const categoryName = (o: FacetOption) => tDynamic(`collections.${o.value}.title`, o.label);

interface FilterPanelProps {
  facets: ProductFacets | undefined;
  catalog: CatalogParams;
  /** Hide facets fixed by the page (e.g. sport on /football). */
  hide?: MultiFilterKey[];
}

function CheckboxList({ options, selected, onToggle }: { options: FacetOption[]; selected: string[]; onToggle: (v: string) => void; name: string }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, 6);
  return (
    <div className="space-y-3">
      {visible.map((o) => (
        <Checkbox
          key={o.value}
          checked={selected.includes(o.value)}
          onChange={() => onToggle(o.value)}
          label={
            <span className="flex w-full justify-between gap-3">
              <span>{o.label}</span>
              <span className="text-ink-500">{o.count}</span>
            </span>
          }
          className="[&>span:last-child]:flex-1"
        />
      ))}
      {options.length > 6 && (
        <button type="button" className="text-xs font-semibold uppercase tracking-[0.12em] underline underline-offset-4" onClick={() => setExpanded((v) => !v)}>
          {expanded ? t('common.actions.showLess') : t('catalog.filters.showAll', { count: options.length })}
        </button>
      )}
    </div>
  );
}

function PriceFilter({ range, min, max, onApply }: { range: { min: number; max: number }; min?: number; max?: number; onApply: (min?: number, max?: number) => void }) {
  const [lo, setLo] = useState(min?.toString() ?? '');
  const [hi, setHi] = useState(max?.toString() ?? '');
  useEffect(() => {
    setLo(min?.toString() ?? '');
    setHi(max?.toString() ?? '');
  }, [min, max]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = lo ? Number(lo) : undefined;
    const b = hi ? Number(hi) : undefined;
    if (a !== undefined && b !== undefined && a > b) onApply(b, a);
    else onApply(a, b);
  };

  const presets = [
    { label: t('catalog.filters.under', { price: formatPrice(5000) }), min: undefined, max: 5000 },
    { label: `${formatPrice(5000)} – ${formatPrice(15000)}`, min: 5000, max: 15000 },
    { label: `${formatPrice(15000)} – ${formatPrice(25000)}`, min: 15000, max: 25000 },
    { label: t('catalog.filters.over', { price: formatPrice(25000) }), min: 25000, max: undefined },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = min === p.min && max === p.max;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => (active ? onApply(undefined, undefined) : onApply(p.min, p.max))}
              aria-pressed={active}
              className={cn('min-h-[36px] border px-3 text-xs transition-colors', active ? 'border-ink bg-ink text-white' : 'border-paper-300 hover:border-ink')}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <form onSubmit={submit} className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-2xs uppercase tracking-[0.12em] text-ink-500">{t('catalog.filters.min')}</span>
          <input type="number" inputMode="numeric" min={0} value={lo} onChange={(e) => setLo(e.target.value)} placeholder={String(range.min)} className="input min-h-[40px] px-3 text-sm" />
        </label>
        <span className="pb-2.5 text-ink-500">–</span>
        <label className="flex-1">
          <span className="mb-1 block text-2xs uppercase tracking-[0.12em] text-ink-500">{t('catalog.filters.max')}</span>
          <input type="number" inputMode="numeric" min={0} value={hi} onChange={(e) => setHi(e.target.value)} placeholder={String(range.max)} className="input min-h-[40px] px-3 text-sm" />
        </label>
        <button type="submit" className="btn btn-sm btn-outline min-h-[40px] px-3" aria-label={t('catalog.filters.applyPrice')}>
          <Check className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export function FilterPanel({ facets, catalog, hide = [] }: FilterPanelProps) {
  const { state, toggle, setPrice, setSingle } = catalog;
  if (!facets) return null;
  const show = (k: MultiFilterKey, options: FacetOption[]) => !hide.includes(k) && options.length > 1;

  return (
    <div className="border-t border-paper-200">
      {show('category', facets.categories) && (
        <AccordionItem title={t('catalog.filters.category')} defaultOpen>
          <CheckboxList name="category" options={facets.categories.map((o) => ({ ...o, label: categoryName(o) }))} selected={state.category} onToggle={(v) => toggle('category', v)} />
        </AccordionItem>
      )}
      {show('sport', facets.sports) && (
        <AccordionItem title={t('catalog.filters.sport')} defaultOpen>
          <CheckboxList name="sport" options={facets.sports.map((o) => ({ ...o, label: SPORT_LABELS[o.value as keyof typeof SPORT_LABELS] ?? o.label }))} selected={state.sport} onToggle={(v) => toggle('sport', v)} />
        </AccordionItem>
      )}
      {show('gender', facets.genders) && (
        <AccordionItem title={t('catalog.filters.gender')}>
          <CheckboxList name="gender" options={facets.genders.map((o) => ({ ...o, label: GENDER_LABELS[o.value as keyof typeof GENDER_LABELS] ?? o.label }))} selected={state.gender} onToggle={(v) => toggle('gender', v)} />
        </AccordionItem>
      )}
      {show('size', facets.sizes) && (
        <AccordionItem title={t('catalog.filters.size')} defaultOpen={state.size.length > 0}>
          <div className="grid grid-cols-4 gap-2">
            {facets.sizes.map((o) => {
              const active = state.size.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle('size', o.value)}
                  aria-pressed={active}
                  className={cn('flex min-h-[40px] items-center justify-center border px-1 text-xs font-medium transition-colors', active ? 'border-ink bg-ink text-white' : 'border-paper-300 hover:border-ink')}
                >
                  {o.value.replace('Size ', '')}
                </button>
              );
            })}
          </div>
        </AccordionItem>
      )}
      {show('color', facets.colors) && (
        <AccordionItem title={t('catalog.filters.colour')} defaultOpen={state.color.length > 0}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {facets.colors.map((o) => {
              const active = state.color.includes(o.value);
              return (
                <button key={o.value} type="button" onClick={() => toggle('color', o.value)} aria-pressed={active} className="flex min-h-[32px] items-center gap-2.5 text-start text-sm">
                  <span className={cn('relative h-6 w-6 shrink-0 rounded-full border', active ? 'border-ink ring-2 ring-ink ring-offset-2' : 'border-ink/15')} style={{ backgroundColor: o.hex }}>
                    {active && <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white mix-blend-difference" aria-hidden />}
                  </span>
                  <span className={cn('truncate', active && 'font-semibold')}>{o.label}</span>
                </button>
              );
            })}
          </div>
        </AccordionItem>
      )}
      <AccordionItem title={t('catalog.filters.price')} defaultOpen={state.minPrice !== undefined || state.maxPrice !== undefined}>
        <PriceFilter range={facets.priceRange} min={state.minPrice} max={state.maxPrice} onApply={setPrice} />
      </AccordionItem>
      <AccordionItem title={t('catalog.filters.rating')}>
        <div className="space-y-1">
          {[4.5, 4, 3.5].map((r) => {
            const active = state.minRating === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setSingle('rating', active ? undefined : String(r))}
                aria-pressed={active}
                className={cn('flex min-h-[40px] w-full items-center gap-2 px-2 text-sm transition-colors', active ? 'bg-paper-200 font-semibold' : 'hover:bg-paper-100')}
              >
                <Star className="h-4 w-4 fill-ink text-ink" aria-hidden /> {t('catalog.filters.stars', { rating: r })}
              </button>
            );
          })}
        </div>
      </AccordionItem>
      {show('brand', facets.brands) && (
        <AccordionItem title={t('catalog.filters.brand')}>
          <CheckboxList name="brand" options={facets.brands} selected={state.brand} onToggle={(v) => toggle('brand', v)} />
        </AccordionItem>
      )}
      <AccordionItem title={t('catalog.filters.availability')} defaultOpen={state.inStock}>
        <Checkbox checked={state.inStock} onChange={() => setSingle('stock', state.inStock ? undefined : '1')} label={t('catalog.filters.inStockOnly')} />
      </AccordionItem>
    </div>
  );
}

/** Removable chips summarising active filters. */
export function ActiveFilters({ facets, catalog }: { facets: ProductFacets | undefined; catalog: CatalogParams }) {
  const { state, toggle, setPrice, setSingle, clearAll, activeCount } = catalog;
  if (!activeCount) return null;
  const label = (key: MultiFilterKey, value: string) => {
    const map: Record<MultiFilterKey, FacetOption[] | undefined> = {
      category: facets?.categories,
      brand: facets?.brands,
      size: facets?.sizes,
      color: facets?.colors,
      gender: facets?.genders,
      sport: facets?.sports,
    };
    const option = map[key]?.find((o) => o.value === value);
    if (key === 'category') return categoryName(option ?? { value, label: value, count: 0 });
    if (key === 'sport') return SPORT_LABELS[value as keyof typeof SPORT_LABELS] ?? option?.label ?? value;
    if (key === 'gender') return GENDER_LABELS[value as keyof typeof GENDER_LABELS] ?? option?.label ?? value;
    return option?.label ?? value;
  };
  const chips: { key: string; text: string; onRemove: () => void }[] = [];
  (['category', 'sport', 'gender', 'size', 'color', 'brand'] as MultiFilterKey[]).forEach((k) =>
    state[k].forEach((v) => chips.push({ key: `${k}-${v}`, text: label(k, v), onRemove: () => toggle(k, v) })),
  );
  if (state.minPrice !== undefined || state.maxPrice !== undefined) {
    const text = `${state.minPrice !== undefined ? formatPrice(state.minPrice) : t('catalog.filters.any')} – ${state.maxPrice !== undefined ? formatPrice(state.maxPrice) : t('catalog.filters.any')}`;
    chips.push({ key: 'price', text, onRemove: () => setPrice(undefined, undefined) });
  }
  if (state.minRating) chips.push({ key: 'rating', text: t('catalog.filters.stars', { rating: state.minRating }), onRemove: () => setSingle('rating', undefined) });
  if (state.inStock) chips.push({ key: 'stock', text: t('catalog.filters.inStock'), onRemove: () => setSingle('stock', undefined) });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onRemove}
          className="group inline-flex min-h-[34px] items-center gap-2 rounded-full border border-paper-300 bg-white pe-2.5 ps-3.5 text-xs font-medium transition-colors hover:border-ink"
          aria-label={t('catalog.filters.removeFilter', { label: c.text })}
        >
          {c.text}
          <X className="h-3.5 w-3.5 text-ink-500 group-hover:text-ink" aria-hidden />
        </button>
      ))}
      <button type="button" onClick={clearAll} className="ms-1 text-xs font-semibold uppercase tracking-[0.12em] underline underline-offset-4">
        {t('common.actions.clearAll')}
      </button>
    </div>
  );
}
