import { useState } from 'react';
import { Calculator } from 'lucide-react';
import type { CouponType } from '@/types';
import { cn } from '@/utils/cn';
import { formatMoney, formatShortDate } from '@/utils/format';
import { CurrencyInput } from '@/components/forms';
import { computeDiscount } from './utils';

export interface CouponPreviewData {
  code: string;
  type: CouponType;
  value: number;
  minOrder: number;
  maxDiscount?: number;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  perCustomerLimit?: number;
  scope: string[];
  enabled: boolean;
}

function headline(d: CouponPreviewData) {
  if (!d.value) return { big: '—', small: 'Set a value' };
  return d.type === 'percentage' ? { big: `${d.value}%`, small: 'OFF' } : { big: formatMoney(d.value).replace(/\s/g, ' '), small: 'OFF' };
}

/** Premium ticket-style preview of a coupon, updated live as the form changes. */
export function CouponTicket({ data }: { data: CouponPreviewData }) {
  const h = headline(data);
  const conditions = [
    data.minOrder > 0 ? `Min. order ${formatMoney(data.minOrder)}` : 'No minimum order',
    data.type === 'percentage' && data.maxDiscount ? `Max discount ${formatMoney(data.maxDiscount)}` : null,
    data.scope.length ? data.scope.join(', ') : 'Entire catalogue',
    data.endsAt ? `Ends ${formatShortDate(data.endsAt)}` : 'No end date',
  ].filter(Boolean) as string[];
  const future = data.startsAt && new Date(data.startsAt).getTime() > Date.now();

  return (
    <div className={cn('relative flex overflow-hidden rounded-2xl bg-ink-950 text-white shadow-pop transition-opacity', !data.enabled && 'opacity-60')} aria-label="Coupon preview">
      <span className="absolute inset-y-0 left-0 w-1.5 bg-volt" aria-hidden />
      <span className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-volt/10 blur-2xl" aria-hidden />

      <div className="min-w-0 flex-1 py-5 pl-6 pr-4 sm:pl-7">
        <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
          <span>
            SPORT<span className="text-volt">X</span> Coupon
          </span>
          {!data.enabled && <span className="rounded bg-white/10 px-1.5 py-0.5 tracking-wider text-zinc-300">Disabled</span>}
          {data.enabled && future && <span className="rounded bg-white/10 px-1.5 py-0.5 tracking-wider text-zinc-300">Starts {formatShortDate(data.startsAt)}</span>}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-5xl font-extrabold italic leading-none tracking-tight text-volt tabular sm:text-6xl">{h.big}</span>
          <span className="font-display text-2xl font-bold italic tracking-wide text-white">{h.small}</span>
        </div>
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-zinc-300">{conditions.join(' · ')}</p>
      </div>

      {/* perforated edge */}
      <div className="relative w-px shrink-0" aria-hidden>
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-white" />
        <span className="absolute -bottom-3 -left-3 h-6 w-6 rounded-full bg-white" />
        <span className="absolute inset-y-4 left-0 border-l-2 border-dashed border-white/20" />
      </div>

      <div className="flex w-32 shrink-0 flex-col items-center justify-center gap-2 px-3 py-5 text-center sm:w-40">
        <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Code</span>
        <span className="break-all rounded-md border border-dashed border-volt/50 px-2 py-1 font-mono text-sm font-bold tracking-wider text-white">{data.code || 'YOURCODE'}</span>
        <span className="text-2xs text-zinc-400">
          {data.usageLimit ? `${data.usageLimit} uses` : 'Unlimited uses'}
          {data.perCustomerLimit ? ` · ${data.perCustomerLimit}/customer` : ''}
        </span>
      </div>
    </div>
  );
}

/** "Example basket → discount → customer pays" calculator. */
export function CouponCalculator({ data }: { data: CouponPreviewData }) {
  const [basket, setBasket] = useState<number | ''>(30000);
  const amount = basket === '' ? 0 : basket;
  const { applies, discount } = computeDiscount(data, amount);
  const capped = applies && data.type === 'percentage' && data.maxDiscount !== undefined && Math.round((amount * data.value) / 100) > data.maxDiscount;
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
      <div className="mb-3 flex items-center gap-2 text-[0.8125rem] font-semibold text-zinc-900">
        <Calculator size={15} className="text-zinc-500" aria-hidden /> Try it on a basket
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <CurrencyInput label="Example basket" value={basket} onValueChange={setBasket} />
        <Figure label="Discount" value={applies && discount ? `− ${formatMoney(discount)}` : formatMoney(0)} tone={applies && discount ? 'good' : 'muted'} />
        <span className="hidden pb-2 text-zinc-300 sm:block" aria-hidden>
          →
        </span>
        <Figure label="Customer pays" value={formatMoney(Math.max(0, amount - discount))} strong />
      </div>
      <p className="mt-2.5 text-xs text-zinc-500" aria-live="polite">
        {!data.value
          ? 'Enter a discount value to see the effect.'
          : !applies && amount > 0
            ? `Not applied — basket is below the ${formatMoney(data.minOrder)} minimum order.`
            : capped
              ? `Capped at the ${formatMoney(data.maxDiscount ?? 0)} maximum discount.`
              : applies
                ? `Customer saves ${Math.round((discount / Math.max(1, amount)) * 100)}% on this basket.`
                : 'Enter a basket amount.'}
      </p>
    </div>
  );
}

function Figure({ label, value, tone, strong }: { label: string; value: string; tone?: 'good' | 'muted'; strong?: boolean }) {
  return (
    <div className="min-w-[120px]">
      <div className="mb-1.5 text-[0.8125rem] font-medium text-zinc-800">{label}</div>
      <div
        className={cn(
          'flex h-9 items-center rounded-lg px-3 text-sm font-semibold tabular',
          strong ? 'bg-ink-950 text-white' : 'border border-zinc-200 bg-white',
          tone === 'good' && 'text-emerald-700',
          tone === 'muted' && 'text-zinc-400',
        )}
      >
        {value}
      </div>
    </div>
  );
}
