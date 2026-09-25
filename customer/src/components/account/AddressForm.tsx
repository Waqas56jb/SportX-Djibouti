import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button, Checkbox, SelectField, TextField } from '@/components/common';
import { COUNTRIES, DJIBOUTI_CITIES, LAUNCH_COUNTRY } from '@/constants/commerce';
import type { Address, AddressInput } from '@/types';
import { phone, required, validate } from '@/utils/validation';

type Values = Omit<AddressInput, 'isDefault' | 'line2' | 'postalCode' | 'district'> & { line2: string; district: string; postalCode: string };

export function AddressForm({ initial, onSubmit, onCancel, saving }: { initial?: Address; onSubmit: (v: AddressInput) => void; onCancel: () => void; saving: boolean }) {
  const [values, setValues] = useState<Values>({
    label: initial?.label ?? 'Home',
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
      label: required('Give this address a name'),
      firstName: required('Enter a first name'),
      lastName: required('Enter a last name'),
      phone,
      line1: (v) => (!v.trim() ? 'Enter the street address' : v.trim().length < 3 ? 'Enter the full street address' : undefined),
      city: required('Select a city'),
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({ ...values, line2: values.line2.trim() || undefined, district: values.district.trim() || undefined, postalCode: values.postalCode.trim() || undefined, isDefault });
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6">
        <TextField label="Address name" placeholder="Home, Work…" value={values.label} onChange={set('label')} error={errors.label} containerClassName="sm:col-span-2" />
        <TextField label="First name" autoComplete="given-name" value={values.firstName} onChange={set('firstName')} error={errors.firstName} />
        <TextField label="Last name" autoComplete="family-name" value={values.lastName} onChange={set('lastName')} error={errors.lastName} />
        <TextField label="Phone" type="tel" autoComplete="tel" placeholder="+253" value={values.phone} onChange={set('phone')} error={errors.phone} containerClassName="sm:col-span-2" />
        <TextField label="Address" autoComplete="address-line1" value={values.line1} onChange={set('line1')} error={errors.line1} containerClassName="sm:col-span-2" />
        <TextField label="Apartment, building, landmark" autoComplete="address-line2" value={values.line2} onChange={set('line2')} optional containerClassName="sm:col-span-2" />
        <TextField label="District / neighbourhood" autoComplete="address-level3" value={values.district} onChange={set('district')} optional containerClassName="sm:col-span-2" />
        <SelectField label="City" value={values.city} onChange={set('city')} error={errors.city} options={DJIBOUTI_CITIES.map((c) => ({ value: c, label: c }))} />
        <SelectField label="Country" value={values.country} onChange={set('country')} options={COUNTRIES.map((c) => ({ value: c.name, label: c.name }))} />
        <TextField label="Postal code" value={values.postalCode} onChange={set('postalCode')} optional />
        <div className="flex items-end pb-3">
          <Checkbox label="Set as default address" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        </div>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-paper-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {initial ? 'Save changes' : 'Add address'}
        </Button>
      </div>
    </form>
  );
}
