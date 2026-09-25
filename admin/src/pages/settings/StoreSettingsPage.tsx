import { useEffect, useMemo, useState } from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import type { CurrencyCode, StoreSettings } from '@/types';
import { settingsService } from '@/services/settingsService';
import { useAsync } from '@/hooks/useAsync';
import { useUiStore } from '@/store/uiStore';
import { toast } from '@/store/toastStore';
import { ErrorState, Skeleton, SkeletonPanel } from '@/components/common/States';
import { FormGrid, FormSection } from '@/components/forms/Field';
import { Input, NumberInput, Select } from '@/components/forms/Inputs';
import { Callout, isSame, ReadOnlyBanner, SaveBar, SettingsLayout, useCanEditSettings } from '@/components/settings/SettingsKit';
import { StoreContactPreview, StoreLogoField } from '@/components/settings/StorePreview';
import { compact, isEmail, isPhone, required } from '@/utils/validation';

type Form = Omit<StoreSettings, 'taxRate' | 'lowStockDefault'> & { taxRate: number | ''; lowStockDefault: number | '' };
type FormErrors = Partial<Record<keyof Form, string>>;

const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: 'DJF', label: 'DJF — Djiboutian franc' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
];

const TIMEZONES = ['Africa/Djibouti', 'Africa/Addis_Ababa', 'Africa/Nairobi', 'Asia/Dubai', 'Europe/Paris', 'Europe/London', 'UTC'].map((z) => ({ value: z, label: z.replace('_', ' ') }));

function validate(f: Form): FormErrors {
  return compact({
    storeName: required(f.storeName, 'Store name'),
    email: f.email.trim() && !isEmail(f.email) ? 'Enter a valid email address.' : undefined,
    phone: f.phone.trim() && !isPhone(f.phone) ? 'Enter a valid phone number, e.g. +253 21 00 00 00.' : undefined,
    addressLine1: required(f.addressLine1, 'Address line 1'),
    city: required(f.city, 'City'),
    country: required(f.country, 'Country'),
    taxRate: f.taxRate === '' ? 'Tax rate is required.' : f.taxRate < 0 || f.taxRate > 100 ? 'Enter a rate between 0 and 100.' : undefined,
    lowStockDefault: f.lowStockDefault === '' ? 'Threshold is required.' : f.lowStockDefault < 0 || !Number.isInteger(f.lowStockDefault) ? 'Use a whole number of 0 or more.' : undefined,
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
    if (data) setForm(data);
  }, [data]);

  const dirty = useMemo(() => Boolean(form && data && !isSame(form, data)), [form, data]);

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

  const setLogo = (url: string | undefined) => {
    if (form?.logoUrl && form.logoUrl !== data?.logoUrl && form.logoUrl.startsWith('blob:')) URL.revokeObjectURL(form.logoUrl);
    set('logoUrl', url);
  };

  const discard = () => {
    if (form?.logoUrl && form.logoUrl !== data?.logoUrl && form.logoUrl.startsWith('blob:')) URL.revokeObjectURL(form.logoUrl);
    if (data) setForm(data);
    setErrors({});
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
      const saved = await settingsService.updateStoreSettings({ ...form, taxRate: Number(form.taxRate), lowStockDefault: Number(form.lowStockDefault), email: form.email.trim() });
      const currencyChanged = saved.currency !== data.currency;
      setData(saved);
      setForm(saved);
      setCurrency(saved.currency);
      toast.success('Store settings saved.', currencyChanged ? { description: `Prices are now labelled in ${saved.currency}. Amounts were not converted.` } : undefined);
    } catch (e) {
      toast.error('Couldn’t save store settings', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const ro = !canEdit;

  return (
    <SettingsLayout title="Store settings" description="Business identity, contact details and regional defaults used across the admin and the storefront.">
      {ro && <ReadOnlyBanner />}
      {error ? (
        <div className="panel">
          <ErrorState onRetry={() => void reload()} description="We couldn’t load the store settings. Please try again." />
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
                  <Input label="Store name" required value={form.storeName} onChange={(e) => set('storeName', e.target.value)} error={errors.storeName} disabled={ro} maxLength={60} />
                  <Input label="Tagline" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} disabled={ro} maxLength={60} help="Shown under the logo on the storefront." optional />
                </FormGrid>
                <StoreLogoField value={form.logoUrl} onChange={setLogo} disabled={ro} />
              </FormSection>

              <FormSection id="contact" title="Contact & address" description="Published in the storefront footer, order emails and invoices.">
                <FormGrid>
                  <Input label="Contact email" type="email" icon={Mail} value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} disabled={ro} placeholder="e.g. contact@your-domain" help="Leave empty until the business email is confirmed." optional autoComplete="off" />
                  <Input label="Phone" type="tel" icon={Phone} value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} disabled={ro} placeholder="+253 …" />
                  <Input label="Address line 1" required icon={MapPin} value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} error={errors.addressLine1} disabled={ro} />
                  <Input label="Address line 2" value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} disabled={ro} optional />
                  <Input label="City" required value={form.city} onChange={(e) => set('city', e.target.value)} error={errors.city} disabled={ro} />
                  <Input label="Country" required value={form.country} onChange={(e) => set('country', e.target.value)} error={errors.country} disabled={ro} />
                </FormGrid>
              </FormSection>

              <FormSection id="regional" title="Regional & defaults" description="Currency, time zone and operational defaults.">
                <FormGrid>
                  <Select label="Store currency" options={CURRENCIES} value={form.currency} onChange={(e) => set('currency', e.target.value as CurrencyCode)} disabled={ro} help="Changing currency relabels prices; it does not convert them." />
                  <Select label="Time zone" options={TIMEZONES} value={form.timezone} onChange={(e) => set('timezone', e.target.value)} disabled={ro} help="Used for reports, order timestamps and scheduled promotions." />
                  <NumberInput label="Default tax rate" suffix="%" min={0} max={100} step={0.5} value={form.taxRate} onValueChange={(v) => set('taxRate', v)} error={errors.taxRate} disabled={ro} help="Applied to new products unless overridden." />
                  <NumberInput label="Default low-stock threshold" suffix="units" min={0} step={1} value={form.lowStockDefault} onValueChange={(v) => set('lowStockDefault', v)} error={errors.lowStockDefault} disabled={ro} help="Variants at or below this quantity are flagged as low stock." />
                </FormGrid>
                {form.currency !== data?.currency && (
                  <Callout tone="warning" title={`Switching from ${data?.currency} to ${form.currency}`}>
                    Existing prices keep their numbers and are simply shown in {form.currency}. Review product prices after saving.
                  </Callout>
                )}
              </FormSection>
            </div>

            <StoreContactPreview s={form} />
          </div>

          {canEdit && <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />}
        </form>
      )}
    </SettingsLayout>
  );
}
