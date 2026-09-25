import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Percent, Shuffle, Wallet } from 'lucide-react';
import type { Coupon, CustomerGroup } from '@/types';
import { Button } from '@/components/common';
import { CurrencyInput, DateInput, FormGrid, Input, MultiSelect, NumberInput, RadioGroup, Toggle } from '@/components/forms';
import { Drawer } from '@/components/modals/Overlay';
import { discountService } from '@/services/discountService';
import { CUSTOMER_GROUPS } from '@/services/customerService';
import { toast } from '@/store/toastStore';
import { CouponCalculator, CouponTicket, type CouponPreviewData } from './CouponTicket';
import { couponToForm, formToInput, validateCoupon, type CouponFormErrors, type CouponFormState } from './couponForm';
import type { MarketingCatalog } from './useMarketingData';
import { applyApiErrors, endOfDayIso, errorMessage, fromLocalInput, generateCouponCode, nameList } from './utils';

export interface CouponDrawerState {
  mode: 'create' | 'edit' | 'duplicate';
  coupon?: Coupon;
}

const COUPON_FIELDS = ['code', 'description', 'type', 'value', 'minOrder', 'maxDiscount', 'usageLimit', 'perCustomerLimit', 'startDate', 'endDate', 'categoryIds', 'productIds', 'customerGroups', 'enabled'] as const satisfies readonly (keyof CouponFormState)[];
const COUPON_ALIAS: Record<string, (typeof COUPON_FIELDS)[number]> = { startsAt: 'startDate', endsAt: 'endDate', minimumOrderAmount: 'minOrder', maximumDiscount: 'maxDiscount', perUserLimit: 'perCustomerLimit', isActive: 'enabled' };

const GROUP_OPTIONS = CUSTOMER_GROUPS.filter((g) => g.id !== 'all').map((g) => ({ value: g.id, label: g.label }));

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-zinc-100 pt-6 first:border-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
        {description && <p className="mt-0.5 text-[0.8125rem] text-zinc-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function CouponFormDrawer({ state, onClose, onSaved, catalog }: { state: CouponDrawerState | null; onClose: () => void; onSaved: (c: Coupon, mode: CouponDrawerState['mode']) => void; catalog: MarketingCatalog }) {
  const [form, setForm] = useState<CouponFormState>(() => couponToForm(undefined));
  const [errors, setErrors] = useState<CouponFormErrors>({});
  const [saving, setSaving] = useState(false);
  const editing = state?.mode === 'edit' ? state.coupon : undefined;

  useEffect(() => {
    if (!state) return;
    setForm(couponToForm(state.coupon, state.mode === 'duplicate'));
    setErrors({});
  }, [state]);

  const set = <K extends keyof CouponFormState>(k: K, v: CouponFormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const preview: CouponPreviewData = useMemo(() => {
    const scope = [
      ...form.categoryIds.map((id) => catalog.categoryById.get(id)?.name).filter((x): x is string => Boolean(x)),
      ...(form.productIds.length ? [`${form.productIds.length} product${form.productIds.length > 1 ? 's' : ''}`] : []),
      ...form.customerGroups.map((g) => CUSTOMER_GROUPS.find((x) => x.id === g)?.label ?? g),
    ];
    return {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: form.value === '' ? 0 : form.value,
      minOrder: form.minOrder === '' ? 0 : form.minOrder,
      maxDiscount: form.type === 'percentage' && form.maxDiscount !== '' ? form.maxDiscount : undefined,
      startsAt: fromLocalInput(form.startDate) || undefined,
      endsAt: form.endDate ? endOfDayIso(form.endDate) : undefined,
      usageLimit: form.usageLimit === '' ? undefined : form.usageLimit,
      perCustomerLimit: form.perCustomerLimit === '' ? undefined : form.perCustomerLimit,
      scope: scope.length > 3 ? [nameList(scope, 2)] : scope,
      enabled: form.enabled,
    };
  }, [form, catalog.categoryById]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateCoupon(form, editing?.usageCount ?? 0);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      toast.error('Check the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      const input = formToInput(form);
      const saved = editing ? await discountService.updateCoupon(editing.id, input) : await discountService.createCoupon(input);
      toast.success(editing ? 'Coupon updated.' : 'Coupon created.', { description: `${saved.code} is ${saved.enabled ? 'ready to use' : 'saved as disabled'}.` });
      onSaved(saved, state?.mode ?? 'create');
    } catch (err) {
      const flagged = applyApiErrors(err, COUPON_FIELDS, (x) => setErrors((prev) => ({ ...prev, ...x })), COUPON_ALIAS);
      toast.error(editing ? 'Couldn’t update coupon.' : 'Couldn’t create coupon.', { description: flagged ? `${errorMessage(err)} Check the highlighted fields.` : errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? `Edit ${editing.code}` : state?.mode === 'duplicate' ? 'Duplicate coupon' : 'Create coupon';

  return (
    <Drawer
      open={Boolean(state)}
      onClose={onClose}
      dismissible={!saving}
      width="xl"
      title={title}
      description={editing ? `${editing.usageCount} redemptions so far. Changes apply to future orders only.` : 'Codes are case-insensitive for customers and stored in uppercase.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="coupon-form" loading={saving}>
            {editing ? 'Save changes' : 'Create coupon'}
          </Button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={submit} noValidate className="space-y-6">
        <div className="space-y-3">
          <div className="eyebrow">Live preview</div>
          <CouponTicket data={preview} />
          <CouponCalculator data={preview} />
        </div>

        <Section title="Code & value">
          <Input
            label="Coupon code"
            required
            value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
            maxLength={32}
            error={errors.code}
            help="3–32 characters: letters, numbers, dash or underscore."
            inputClassName="font-mono tracking-wider uppercase"
            placeholder="MATCHDAY15"
            autoComplete="off"
            data-autofocus
            aside={
              <button type="button" onClick={() => set('code', generateCouponCode())} className="inline-flex items-center gap-1 font-medium text-zinc-700 hover:text-zinc-950">
                <Shuffle size={12} aria-hidden /> Generate
              </button>
            }
          />
          <Input label="Internal note" optional value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={120} error={errors.description} placeholder="e.g. 15% off football boots for matchday" />
          <RadioGroup
            label="Discount type"
            variant="cards"
            value={form.type}
            onChange={(v) => set('type', v)}
            options={[
              { value: 'percentage', label: <span className="inline-flex items-center gap-1.5"><Percent size={14} aria-hidden /> Percentage</span>, description: 'e.g. 15% off the eligible basket' },
              { value: 'fixed', label: <span className="inline-flex items-center gap-1.5"><Wallet size={14} aria-hidden /> Fixed amount</span>, description: 'e.g. DJF 2,000 off the order' },
            ]}
          />
          <FormGrid cols={2}>
            {form.type === 'percentage' ? (
              <NumberInput label="Discount value" required value={form.value} onValueChange={(v) => set('value', v)} min={1} max={100} suffix="%" error={errors.value} />
            ) : (
              <CurrencyInput label="Discount value" required value={form.value} onValueChange={(v) => set('value', v)} error={errors.value} />
            )}
            <CurrencyInput label="Minimum order" optional value={form.minOrder} onValueChange={(v) => set('minOrder', v)} error={errors.minOrder} help="Basket subtotal before discount." />
            {form.type === 'percentage' && (
              <CurrencyInput label="Maximum discount" optional value={form.maxDiscount} onValueChange={(v) => set('maxDiscount', v)} error={errors.maxDiscount} help="Caps the saving on large baskets." />
            )}
          </FormGrid>
        </Section>

        <Section title="Limits & schedule" description="Leave limits empty for unlimited use.">
          <FormGrid cols={2}>
            <NumberInput label="Usage limit" optional value={form.usageLimit} onValueChange={(v) => set('usageLimit', v)} min={1} error={errors.usageLimit} help="Total redemptions across all customers." />
            <NumberInput label="Per-customer limit" optional value={form.perCustomerLimit} onValueChange={(v) => set('perCustomerLimit', v)} min={1} error={errors.perCustomerLimit} />
            <DateInput label="Start date" required value={form.startDate} onChange={(e) => set('startDate', e.target.value)} error={errors.startDate} />
            <DateInput label="End date" optional value={form.endDate} min={form.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} error={errors.endDate} help="Valid until the end of this day." />
          </FormGrid>
        </Section>

        <Section title="Eligibility" description="Leave everything empty to apply the coupon to the whole catalogue and every customer.">
          <MultiSelect label="Applicable categories" optional options={catalog.categoryOptions} value={form.categoryIds} onChange={(v) => set('categoryIds', v)} error={errors.categoryIds} placeholder={catalog.loading ? 'Loading categories…' : 'All categories'} />
          <MultiSelect label="Applicable products" optional options={catalog.productOptions} value={form.productIds} onChange={(v) => set('productIds', v)} error={errors.productIds} placeholder={catalog.loading ? 'Loading products…' : 'All products'} maxChips={3} help="Search by name or SKU." />
          <MultiSelect label="Customer groups" optional options={GROUP_OPTIONS} value={form.customerGroups} onChange={(v) => set('customerGroups', v as CustomerGroup[])} error={errors.customerGroups} placeholder="All customers" searchable={false} />
        </Section>

        <Section title="Availability">
          <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label="Coupon enabled" description="Disabled coupons are rejected at checkout but keep their history." />
        </Section>
      </form>
    </Drawer>
  );
}
