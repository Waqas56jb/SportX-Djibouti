import { useEffect, useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import type { CouponType, Discount, DiscountInput } from '@/types';
import { Button, Segmented } from '@/components/common';
import { CurrencyInput, DateInput, FormGrid, Input, MultiSelect, NumberInput, RadioGroup, Toggle } from '@/components/forms';
import { Drawer } from '@/components/modals/Overlay';
import { discountService } from '@/services/discountService';
import { toast } from '@/store/toastStore';
import type { MarketingCatalog } from './useMarketingData';
import { discountLabel, endOfDayIso, errorMessage, fromLocalInput, nameList, toLocalDateInput } from './utils';

type AppliesTo = Discount['appliesTo'];

interface FormState {
  name: string;
  type: CouponType;
  value: number | '';
  appliesTo: AppliesTo;
  targetIds: string[];
  startDate: string;
  endDate: string;
  enabled: boolean;
}
type Errors = Partial<Record<keyof FormState, string>>;

const APPLIES: { value: AppliesTo; label: string }[] = [
  { value: 'all', label: 'All products' },
  { value: 'categories', label: 'Categories' },
  { value: 'products', label: 'Products' },
  { value: 'brands', label: 'Brands' },
];

function toForm(d?: Discount): FormState {
  return {
    name: d?.name ?? '',
    type: d?.type ?? 'percentage',
    value: d?.value ?? 10,
    appliesTo: d?.appliesTo ?? 'all',
    targetIds: d ? [...d.targetIds] : [],
    startDate: toLocalDateInput(d?.startsAt ?? new Date().toISOString()),
    endDate: toLocalDateInput(d?.endsAt),
    enabled: d?.enabled ?? true,
  };
}

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 3) e.name = 'Give the discount a name of at least 3 characters.';
  if (f.value === '' || f.value <= 0) e.value = 'Enter a value greater than zero.';
  else if (f.type === 'percentage' && f.value > 90) e.value = 'Automatic discounts are capped at 90%.';
  if (f.appliesTo !== 'all' && f.targetIds.length === 0) e.targetIds = `Select at least one ${f.appliesTo === 'categories' ? 'category' : f.appliesTo === 'products' ? 'product' : 'brand'}.`;
  if (!f.startDate) e.startDate = 'Start date is required.';
  if (f.endDate && f.startDate && endOfDayIso(f.endDate) <= fromLocalInput(f.startDate)) e.endDate = 'End date can’t be before the start date.';
  return e;
}

/** Human summary of what a discount targets, e.g. "3 categories: Football, Running +1". */
export function describeTargets(d: Pick<Discount, 'appliesTo' | 'targetIds'>, catalog: MarketingCatalog): string {
  if (d.appliesTo === 'all') return 'Entire catalogue';
  const names = d.targetIds
    .map((id) => (d.appliesTo === 'categories' ? catalog.categoryById.get(id)?.name : d.appliesTo === 'products' ? catalog.productById.get(id)?.name : catalog.brandById.get(id)?.name))
    .filter((x): x is string => Boolean(x));
  if (!names.length) return `${d.targetIds.length} ${d.appliesTo}`;
  return nameList(names, 2);
}

export function DiscountFormDrawer({ open, discount, onClose, onSaved, catalog }: { open: boolean; discount?: Discount; onClose: () => void; onSaved: (d: Discount, created: boolean) => void; catalog: MarketingCatalog }) {
  const [form, setForm] = useState<FormState>(() => toForm());
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(discount));
    setErrors({});
  }, [open, discount]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    const input: DiscountInput = {
      name: form.name.trim(),
      type: form.type,
      value: form.value === '' ? 0 : form.value,
      appliesTo: form.appliesTo,
      targetIds: form.appliesTo === 'all' ? [] : form.targetIds,
      startsAt: fromLocalInput(form.startDate),
      endsAt: form.endDate ? endOfDayIso(form.endDate) : undefined,
      enabled: form.enabled,
    };
    setSaving(true);
    try {
      const saved = discount ? await discountService.updateDiscount(discount.id, input) : await discountService.createDiscount(input);
      toast.success(discount ? 'Discount updated.' : 'Discount created.', { description: saved.name });
      onSaved(saved, !discount);
    } catch (err) {
      toast.error('Couldn’t save discount.', { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const targetOptions = form.appliesTo === 'categories' ? catalog.categoryOptions : form.appliesTo === 'products' ? catalog.productOptions : catalog.brandOptions;
  const value = form.value === '' ? 0 : form.value;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={discount ? 'Edit automatic discount' : 'Create automatic discount'}
      description="Applied automatically at checkout — no code needed."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="discount-form" loading={saving}>
            {discount ? 'Save changes' : 'Create discount'}
          </Button>
        </>
      }
    >
      <form id="discount-form" onSubmit={submit} noValidate className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl bg-ink-950 px-4 py-3.5 text-white">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-volt text-ink-950">
            <Sparkles size={17} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{form.name.trim() || 'Untitled discount'}</div>
            <div className="truncate text-[0.8125rem] text-zinc-400">
              <span className="font-semibold text-volt">{value ? `${discountLabel(form.type, value)} off` : 'Set a value'}</span> · {describeTargets(form, catalog)}
            </div>
          </div>
        </div>

        <Input label="Name" required value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} maxLength={80} placeholder="e.g. Running week — 15% off" data-autofocus />
        <RadioGroup
          label="Discount type"
          variant="cards"
          value={form.type}
          onChange={(v) => set('type', v)}
          options={[
            { value: 'percentage', label: 'Percentage', description: 'Off each eligible item' },
            { value: 'fixed', label: 'Fixed amount', description: 'Off each eligible item' },
          ]}
        />
        {form.type === 'percentage' ? (
          <NumberInput label="Value" required value={form.value} onValueChange={(v) => set('value', v)} min={1} max={90} suffix="%" error={errors.value} />
        ) : (
          <CurrencyInput label="Value" required value={form.value} onValueChange={(v) => set('value', v)} error={errors.value} />
        )}

        <div>
          <div className="mb-2 text-[0.8125rem] font-medium text-zinc-800">Applies to</div>
          <Segmented
            ariaLabel="Applies to"
            options={APPLIES}
            value={form.appliesTo}
            onChange={(v) => {
              setForm((f) => ({ ...f, appliesTo: v, targetIds: [] }));
              setErrors((e) => ({ ...e, targetIds: undefined }));
            }}
          />
          {form.appliesTo !== 'all' && (
            <MultiSelect
              className="mt-3"
              label={`Select ${form.appliesTo}`}
              required
              options={targetOptions}
              value={form.targetIds}
              onChange={(v) => set('targetIds', v)}
              error={errors.targetIds}
              placeholder={catalog.loading ? 'Loading…' : `Choose ${form.appliesTo}`}
            />
          )}
        </div>

        <FormGrid cols={2}>
          <DateInput label="Start date" required value={form.startDate} onChange={(e) => set('startDate', e.target.value)} error={errors.startDate} />
          <DateInput label="End date" optional value={form.endDate} min={form.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} error={errors.endDate} />
        </FormGrid>
        <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label="Discount enabled" description="Turn off to pause without deleting." />
      </form>
    </Drawer>
  );
}
