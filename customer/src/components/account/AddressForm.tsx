import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button, Checkbox, SelectField, TextField } from '@/components/common';
import { COUNTRIES, DJIBOUTI_CITIES, LAUNCH_COUNTRY } from '@/constants/commerce';
import { useT } from '@/i18n';
import type { Address, AddressInput } from '@/types';
import { phone, required, validate } from '@/utils/validation';

type Values = Omit<AddressInput, 'isDefault' | 'line2' | 'postalCode' | 'district'> & { line2: string; district: string; postalCode: string };

export function AddressForm({ initial, onSubmit, onCancel, saving }: { initial?: Address; onSubmit: (v: AddressInput) => void; onCancel: () => void; saving: boolean }) {
  const { t } = useT();
  const [values, setValues] = useState<Values>({
    label: initial?.label ?? t('account.addressForm.defaultName'),
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    phone: initial?.phone ?? '',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    district: initial?.district ?? '',
    city: initial?.city ?? DJIBOUTI_CITIES[0],
    country: initial?.country ?? LAUNCH_COUNTRY,
    postalCode: initial?.postalCode ?? '',
  });
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});

  const set = (k: keyof Values) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(values, {
      label: required(t('account.addressForm.errName')),
      firstName: required(t('account.addressForm.errFirstName')),
      lastName: required(t('account.addressForm.errLastName')),
      phone,
      line1: (v) => (!v.trim() ? t('account.addressForm.errStreet') : v.trim().length < 3 ? t('account.addressForm.errStreetFull') : undefined),
      city: required(t('account.addressForm.errCity')),
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({ ...values, line2: values.line2.trim() || undefined, district: values.district.trim() || undefined, postalCode: values.postalCode.trim() || undefined, isDefault });
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6">
        <TextField label={t('account.addressForm.name')} placeholder={t('account.addressForm.namePlaceholder')} value={values.label} onChange={set('label')} error={errors.label} containerClassName="sm:col-span-2" />
        <TextField label={t('auth.fields.firstName')} autoComplete="given-name" value={values.firstName} onChange={set('firstName')} error={errors.firstName} />
        <TextField label={t('auth.fields.lastName')} autoComplete="family-name" value={values.lastName} onChange={set('lastName')} error={errors.lastName} />
        <TextField label={t('auth.fields.phone')} type="tel" dir="ltr" autoComplete="tel" placeholder={t('auth.fields.phonePlaceholder')} value={values.phone} onChange={set('phone')} error={errors.phone} containerClassName="sm:col-span-2" />
        <TextField label={t('account.addressForm.address')} autoComplete="address-line1" value={values.line1} onChange={set('line1')} error={errors.line1} containerClassName="sm:col-span-2" />
        <TextField label={t('account.addressForm.line2')} autoComplete="address-line2" value={values.line2} onChange={set('line2')} optional containerClassName="sm:col-span-2" />
        <TextField label={t('account.addressForm.district')} autoComplete="address-level3" value={values.district} onChange={set('district')} optional containerClassName="sm:col-span-2" />
        <SelectField label={t('account.addressForm.city')} value={values.city} onChange={set('city')} error={errors.city} options={DJIBOUTI_CITIES.map((c) => ({ value: c, label: c }))} />
        <SelectField label={t('account.addressForm.country')} value={values.country} onChange={set('country')} options={COUNTRIES.map((c) => ({ value: c.name, label: c.name }))} />
        <TextField label={t('account.addressForm.postalCode')} value={values.postalCode} onChange={set('postalCode')} optional />
        <div className="flex items-end pb-3">
          <Checkbox label={t('account.addressForm.setDefault')} checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        </div>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-paper-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {initial ? t('common.actions.saveChanges') : t('account.addresses.add')}
        </Button>
      </div>
    </form>
  );
}
