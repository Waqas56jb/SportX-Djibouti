import { useEffect, useState } from 'react';
import type { PaymentMethod, PaymentStatus, ShippingStatus } from '@/types';
import { PAYMENT_METHOD, PAYMENT_STATUS, SHIPPING_STATUS } from '@/constants/status';
import { getActiveCurrency } from '@/utils/format';
import { useDebounce } from '@/hooks/misc';
import { DateInput, FilterSelect, SearchInput } from '@/components/forms';
import { ClearFiltersButton } from '@/components/tables';
import { DATE_PRESETS } from './orderMeta';

export type OrderFilterValues = {
  status: string;
  search: string;
  date: string;
  from: string;
  to: string;
  payment: string;
  method: string;
  shipping: string;
  min: string;
  max: string;
};

const PAYMENT_OPTIONS = (Object.keys(PAYMENT_STATUS) as PaymentStatus[]).map((v) => ({ value: v, label: PAYMENT_STATUS[v].label }));
const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD) as PaymentMethod[]).map((v) => ({ value: v, label: PAYMENT_METHOD[v] }));
const SHIPPING_OPTIONS = (Object.keys(SHIPPING_STATUS) as ShippingStatus[]).map((v) => ({ value: v, label: SHIPPING_STATUS[v].label }));

/** URL-synced toolbar for the orders list. Text inputs are debounced before hitting the URL. */
export function OrderFilters({ filters, setFilter, activeCount, onClear }: { filters: OrderFilterValues; setFilter: (k: keyof OrderFilterValues, v: string) => void; activeCount: number; onClear: () => void }) {
  const [search, setSearch] = useState(filters.search);
  const [min, setMin] = useState(filters.min);
  const [max, setMax] = useState(filters.max);
  const ds = useDebounce(search, 250);
  const dmin = useDebounce(min, 400);
  const dmax = useDebounce(max, 400);

  useEffect(() => {
    if (ds !== filters.search) setFilter('search', ds);
  }, [ds]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (dmin !== filters.min) setFilter('min', dmin);
  }, [dmin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (dmax !== filters.max) setFilter('max', dmax);
  }, [dmax]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep local inputs in sync when filters are cleared externally.
  useEffect(() => {
    if (!filters.search) setSearch('');
    if (!filters.min) setMin('');
    if (!filters.max) setMax('');
  }, [filters.search, filters.min, filters.max]);

  const rangeInvalid = min !== '' && max !== '' && Number(min) > Number(max);
  const dateInvalid = filters.date === 'custom' && filters.from && filters.to && filters.from > filters.to;
  const currency = getActiveCurrency();
  const amountCls =
    'h-8 w-24 rounded-lg border bg-white px-2.5 text-[0.8125rem] shadow-sm tabular placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 ' +
    (rangeInvalid ? 'border-red-400' : 'border-zinc-200 hover:border-zinc-300');

  return (
    <>
      <SearchInput value={search} onChange={setSearch} placeholder="Order ID, customer, email or phone…" className="w-full sm:w-72" label="Search orders" />
      <FilterSelect label="Date" allLabel="Any time" value={filters.date} onChange={(v) => setFilter('date', v)} options={DATE_PRESETS.filter((p) => p.value)} />
      {filters.date === 'custom' && (
        <div className="flex items-center gap-1.5">
          <DateInput aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} inputClassName="h-8 w-[140px] text-[0.8125rem]" />
          <span className="text-xs text-zinc-400">to</span>
          <DateInput aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} inputClassName="h-8 w-[140px] text-[0.8125rem]" />
        </div>
      )}
      <FilterSelect label="Payment" value={filters.payment} onChange={(v) => setFilter('payment', v)} options={PAYMENT_OPTIONS} />
      <FilterSelect label="Method" allLabel="Any method" value={filters.method} onChange={(v) => setFilter('method', v)} options={METHOD_OPTIONS} />
      <FilterSelect label="Shipping" value={filters.shipping} onChange={(v) => setFilter('shipping', v)} options={SHIPPING_OPTIONS} />
      <div className="flex items-center gap-1.5" role="group" aria-label={`Order total range in ${currency}`}>
        <input type="number" min={0} inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder={`Min ${currency}`} aria-label="Minimum total" aria-invalid={rangeInvalid || undefined} className={amountCls} />
        <span className="text-xs text-zinc-400">–</span>
        <input type="number" min={0} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder={`Max ${currency}`} aria-label="Maximum total" aria-invalid={rangeInvalid || undefined} className={amountCls} />
      </div>
      {(rangeInvalid || dateInvalid) && (
        <span role="alert" className="text-xs font-medium text-red-600">
          {rangeInvalid ? 'Min is greater than max.' : 'Start date is after end date.'}
        </span>
      )}
      <ClearFiltersButton count={activeCount} onClear={onClear} />
    </>
  );
}
