import { useEffect, useMemo, useState } from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import type { CurrencyCode, StoreSettings } from '@/types';
import { settingsService } from '@/services/settingsService';
import { useAsync } from '@/hooks/useAsync';
import { useUiStore } from '@/store/uiStore';
import { toast } from '@/store/toastStore';
import { ErrorState, Skeleton, SkeletonPanel } from '@/components/common/States';
import { FormGrid, FormSection } from '@/components/forms/Field';
import { CurrencyInput, Input, NumberInput, Select } from '@/components/forms/Inputs';
import { Toggle } from '@/components/forms/Choice';
import { Callout, isSame, ReadOnlyBanner, SaveBar, SettingsLayout, useCanEditSettings } from '@/components/settings/SettingsKit';
import { StoreContactPreview, StoreLogoField } from '@/components/settings/StorePreview';
import { errorMessage, handleFormError } from '@/components/settings/formErrors';
import { compact, isEmail, isPhone, required } from '@/utils/validation';

type NumKey = 'taxRate' | 'lowStockDefault' | 'freeShippingThreshold' | 'maxQuantityPerLine' | 'pendingPaymentTtlMinutes';
type Form = Omit<StoreSettings, NumKey | 'logoUrl' | 'updatedAt' | 'taxInclusive' | 'orderPrefix'> & Record<NumKey, number | ''> & { taxInclusive: boolean; orderPrefix: string };
type FormErrors = Partial<Record<keyof Form, string>>;

const FORM_FIELDS = [
  'storeName', 'tagline', 'email', 'phone', 'addressLine1', 'addressLine2', 'city', 'country', 'currency', 'timezone',
  'taxRate', 'taxInclusive', 'lowStockDefault', 'freeShippingThreshold', 'orderPrefix', 'maxQuantityPerLine', 'pendingPaymentTtlMinutes',
] as const;

const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: 'DJF', label: 'DJF — Djiboutian franc' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
];

const BASE_TIMEZONES = ['Africa/Djibouti', 'Africa/Addis_Ababa', 'Africa/Nairobi', 'Asia/Dubai', 'Europe/Paris', 'Europe/London', 'UTC'];

const toForm = (s: StoreSettings): Form => ({
  storeName: s.storeName,
  tagline: s.tagline,
  email: s.email,
  phone: s.phone,
  addressLine1: s.addressLine1,
  addressLine2: s.addressLine2,
  city: s.city,
  country: s.country,
  currency: s.currency,
  timezone: s.timezone,
  taxRate: s.taxRate,
  lowStockDefault: s.lowStockDefault,
  taxInclusive: s.taxInclusive ?? false,
  freeShippingThreshold: s.freeShippingThreshold ?? '',
  orderPrefix: s.orderPrefix ?? '',
  maxQuantityPerLine: s.maxQuantityPerLine ?? 10,
  pendingPaymentTtlMinutes: s.pendingPaymentTtlMinutes ?? 60,
});

const isInt = (v: number | '', min: number, max: number) => v !== '' && Number.isInteger(v) && v >= min && v <= max;

function validate(f: Form): FormErrors {
  return compact({
    storeName: required(f.storeName, 'Store name') ?? (f.storeName.trim().length < 2 ? 'Use at least 2 characters.' : undefined),
    email: f.email.trim() && !isEmail(f.email) ? 'Enter a valid email address.' : undefined,
    phone: f.phone.trim() && !isPhone(f.phone) ? 'Enter a valid phone number, e.g. +253 21 00 00 00.' : undefined,
    addressLine1: required(f.addressLine1, 'Address line 1'),
    city: required(f.city, 'City'),
    country: required(f.country, 'Country'),
    taxRate: f.taxRate === '' ? 'Tax rate is required.' : f.taxRate < 0 || f.taxRate > 100 ? 'Enter a rate between 0 and 100.' : undefined,
    lowStockDefault: isInt(f.lowStockDefault, 0, 100_000) ? undefined : 'Use a whole number of 0 or more.',
    freeShippingThreshold: f.freeShippingThreshold === '' || isInt(f.freeShippingThreshold, 0, 1_000_000_000) ? undefined : 'Enter a whole amount, or leave empty.',
    orderPrefix: /^[A-Za-z]{2,6}$/.test(f.orderPrefix.trim()) ? undefined : 'Use 2–6 letters.',
    maxQuantityPerLine: isInt(f.maxQuantityPerLine, 1, 10) ? undefined : 'Enter a whole number from 1 to 10.',
    pendingPaymentTtlMinutes: isInt(f.pendingPaymentTtlMinutes, 5, 10_080) ? undefined : 'Enter 5 to 10 080 minutes.',
  }) as FormErrors;
}

function StoreSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" aria-busy="true" aria-label="Loading store settings">
      <div className="space-y-6">
        <SkeletonPanel rows={5} />
        <SkeletonPanel rows={6} />
        <SkeletonPanel rows={3} />
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

export default function StoreSettingsPage() {
  const canEdit = useCanEditSettings();
  const setCurrency = useUiStore((s) => s.setCurrency);
  const { data, loading, error, reload, setData } = useAsync(() => settingsService.getStoreSettings(), []);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  const dirty = useMemo(() => Boolean(form && data && !isSame(form, toForm(data))), [form, data]);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const discard = () => {
    if (data) setForm(toForm(data));
    setErrors({});
  };

  const uploadLogo = async (file: File) => {
    try {
      const saved = await settingsService.uploadLogo(file);
      // Only the logo changes; keep any unsaved form edits.
      setData((d) => (d ? { ...d, logoUrl: saved.logoUrl, updatedAt: saved.updatedAt } : saved));
      toast.success('Logo updated.', { description: 'The new logo is live on the storefront.' });
    } catch (e) {
      toast.error('Couldn’t upload the logo', { description: errorMessage(e) });
    }
  };

  const save = async () => {
    if (!form || !data) return;
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Check the highlighted fields', { description: 'Some settings are missing or invalid.' });
      return;
    }
    setSaving(true);
    try {
      const saved = await settingsService.updateStoreSettings({
        ...form,
        email: form.email.trim(),
        orderPrefix: form.orderPrefix.trim().toUpperCase(),
        taxRate: Number(form.taxRate),
        lowStockDefault: Number(form.lowStockDefault),
        freeShippingThreshold: form.freeShippingThreshold === '' ? null : Number(form.freeShippingThreshold),
        maxQuantityPerLine: Number(form.maxQuantityPerLine),
        pendingPaymentTtlMinutes: Number(form.pendingPaymentTtlMinutes),
      });
      const currencyChanged = saved.currency !== data.currency;
      setData(saved);
      setForm(toForm(saved));
      setCurrency(saved.currency);
      toast.success('Store settings saved.', currencyChanged ? { description: `Prices are now labelled in ${saved.currency}. Amounts were not converted.` } : undefined);
    } catch (e) {
      setErrors(handleFormError(e, 'Couldn’t save store settings', { alias: { supportEmail: 'email' }, fields: FORM_FIELDS }) as FormErrors);
    } finally {
      setSaving(false);
    }
  };

  const ro = !canEdit;
  const timezones = [...new Set([...(form ? [form.timezone] : []), ...BASE_TIMEZONES])].map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));

  return (
    <SettingsLayout title="Store settings" description="Business identity, contact details and regional defaults used across the admin and the storefront.">
      {ro && <ReadOnlyBanner />}
      {error ? (
        <div className="panel">
          <ErrorState onRetry={() => void reload()} description={error.message || 'We couldn’t load the store settings. Please try again.'} />
        </div>
      ) : loading || !form ? (
        <StoreSkeleton />
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (canEdit && dirty) void save();
          }}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6">
              <FormSection id="identity" title="Store identity" description="How SPORTX presents itself to customers.">
                <FormGrid>
                  <Input label="Store name" required value={form.storeName} onChange={(e) => set('storeName', e.target.value)} error={errors.storeName} disabled={ro} maxLength={80} />
                  <Input label="Tagline" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} error={errors.tagline} disabled={ro} maxLength={160} help="Shown under the logo on the storefront." optional />
                </FormGrid>
                <StoreLogoField value={data?.logoUrl} onUpload={uploadLogo} disabled={ro} />
              </FormSection>

              <FormSection id="contact" title="Contact & address" description="Published in the storefront footer, order emails and invoices.">
                <FormGrid>
                  <Input label="Contact email" type="email" icon={Mail} value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} disabled={ro} placeholder="e.g. contact@your-domain" help="Leave empty until the business email is confirmed." optional autoComplete="off" />
                  <Input label="Phone" type="tel" icon={Phone} value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} disabled={ro} placeholder="+253 …" />
                  <Input label="Address line 1" required icon={MapPin} value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} error={errors.addressLine1} disabled={ro} />
                  <Input label="Address line 2" value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} error={errors.addressLine2} disabled={ro} optional />
                  <Input label="City" required value={form.city} onChange={(e) => set('city', e.target.value)} error={errors.city} disabled={ro} />
                  <Input label="Country" required value={form.country} onChange={(e) => set('country', e.target.value)} error={errors.country} disabled={ro} />
                </FormGrid>
              </FormSection>

              <FormSection id="regional" title="Regional & tax" description="Currency, time zone and tax defaults.">
                <FormGrid>
                  <Select label="Store currency" options={CURRENCIES} value={form.currency} onChange={(e) => set('currency', e.target.value as CurrencyCode)} error={errors.currency} disabled={ro} help="Changing currency relabels prices; it does not convert them." />
                  <Select label="Time zone" options={timezones} value={form.timezone} onChange={(e) => set('timezone', e.target.value)} error={errors.timezone} disabled={ro} help="Used for reports, order timestamps and scheduled promotions." />
                  <NumberInput label="Default tax rate" suffix="%" min={0} max={100} step={0.5} value={form.taxRate} onValueChange={(v) => set('taxRate', v)} error={errors.taxRate} disabled={ro} help="Applied at checkout." />
                  <NumberInput label="Default low-stock threshold" suffix="units" min={0} step={1} value={form.lowStockDefault} onValueChange={(v) => set('lowStockDefault', v)} error={errors.lowStockDefault} disabled={ro} help="Variants at or below this quantity are flagged as low stock." />
                </FormGrid>
                <div className="rounded-xl border border-zinc-200 px-4 py-3">
                  <Toggle label="Prices include tax" description="When on, product prices already contain tax and checkout doesn’t add it on top." checked={form.taxInclusive} onChange={(v) => set('taxInclusive', v)} disabled={ro} />
                </div>
                {form.currency !== data?.currency && (
                  <Callout tone="warning" title={`Switching from ${data?.currency} to ${form.currency}`}>
                    Existing prices keep their numbers and are simply shown in {form.currency}. Review product prices after saving.
                  </Callout>
                )}
              </FormSection>

              <FormSection id="checkout" title="Checkout & orders" description="Rules applied to every cart and order.">
                <FormGrid>
                  <CurrencyInput label="Free shipping over" optional value={form.freeShippingThreshold} onValueChange={(v) => set('freeShippingThreshold', v)} error={errors.freeShippingThreshold} disabled={ro} help="Store-wide threshold. Leave empty to always charge shipping." />
                  <Input label="Order number prefix" required value={form.orderPrefix} onChange={(e) => set('orderPrefix', e.target.value.toUpperCase())} error={errors.orderPrefix} disabled={ro} maxLength={6} help="2–6 letters, e.g. SPX → SPX-000123." />
                  <NumberInput label="Max quantity per cart line" min={1} max={10} step={1} value={form.maxQuantityPerLine} onValueChange={(v) => set('maxQuantityPerLine', v)} error={errors.maxQuantityPerLine} disabled={ro} help="Between 1 and 10 of the same variant." />
                  <NumberInput label="Unpaid order hold" suffix="min" min={5} max={10080} step={5} value={form.pendingPaymentTtlMinutes} onValueChange={(v) => set('pendingPaymentTtlMinutes', v)} error={errors.pendingPaymentTtlMinutes} disabled={ro} help="How long stock stays reserved for an unpaid online payment." />
                </FormGrid>
              </FormSection>
            </div>

            <StoreContactPreview s={{ ...form, logoUrl: data?.logoUrl }} />
          </div>

          {canEdit && <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />}
        </form>
      )}
    </SettingsLayout>
  );
}
