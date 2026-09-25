import { useEffect, useState, type FormEvent } from 'react';
import { Mail, Phone } from 'lucide-react';
import type { Customer, CustomerInput, CustomerStatus } from '@/types';
import { Avatar, Button } from '@/components/common';
import { FormGrid, Input, Select, Textarea, Toggle } from '@/components/forms';
import { Drawer } from '@/components/modals/Overlay';
import { CUSTOMER_STATUS } from '@/constants/status';
import { customerService } from '@/services/customerService';
import { toast } from '@/store/toastStore';
import { formatDate } from '@/utils/format';
import { compact, isEmail, isPhone, required, type Errors } from '@/utils/validation';
import { fullName } from './useCustomerStatus';

const STATUS_OPTIONS = (Object.keys(CUSTOMER_STATUS) as CustomerStatus[]).map((s) => ({ value: s, label: CUSTOMER_STATUS[s].label }));

const toInput = (c: Customer): CustomerInput => ({
  firstName: c.firstName,
  lastName: c.lastName,
  email: c.email,
  phone: c.phone,
  status: c.status,
  marketingOptIn: c.marketingOptIn,
  notes: c.notes ?? '',
});

function validate(v: CustomerInput): Errors<CustomerInput> {
  return compact({
    firstName: required(v.firstName, 'First name'),
    lastName: required(v.lastName, 'Last name'),
    email: required(v.email, 'Email') ?? (isEmail(v.email) ? undefined : 'Enter a valid email address.'),
    phone: required(v.phone, 'Phone') ?? (isPhone(v.phone) ? undefined : 'Enter a valid phone number, e.g. +253 77 12 34 56.'),
  });
}

export interface CustomerFormDrawerProps {
  customer: Customer | null;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}

/** Side drawer for editing a customer's profile, status and marketing preferences. */
export function CustomerFormDrawer({ customer, onClose, onSaved }: CustomerFormDrawerProps) {
  const [form, setForm] = useState<CustomerInput | null>(customer ? toInput(customer) : null);
  const [errors, setErrors] = useState<Errors<CustomerInput>>({});
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(customer ? toInput(customer) : null);
    setErrors({});
    setTouched(false);
  }, [customer]);

  const set = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) => {
    if (!form) return;
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched) setErrors(validate(next));
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!customer || !form) return;
    setTouched(true);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const payload: CustomerInput = { ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), notes: form.notes?.trim() || undefined };
      const updated = await customerService.updateCustomer(customer.id, payload);
      toast.success('Customer updated.', { description: fullName(updated) });
      onSaved(updated);
      onClose();
    } catch (err) {
      toast.error('Could not update customer', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={Boolean(customer)}
      onClose={onClose}
      dismissible={!saving}
      title="Edit customer"
      description={customer ? `Customer since ${formatDate(customer.joinedAt)}` : undefined}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      {customer && form && (
        <form onSubmit={submit} noValidate className="space-y-6">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            <Avatar name={fullName(customer)} src={customer.avatarUrl} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">{fullName(customer)}</p>
              <p className="truncate text-xs text-zinc-500">
                {customer.ordersCount} orders · ID {customer.id}
              </p>
            </div>
          </div>

          <FormGrid>
            <Input label="First name" required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} error={errors.firstName} autoComplete="off" data-autofocus />
            <Input label="Last name" required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} error={errors.lastName} autoComplete="off" />
          </FormGrid>
          <Input label="Email" type="email" required icon={Mail} value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} autoComplete="off" />
          <Input label="Phone" type="tel" required icon={Phone} value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} help="Include the country code, e.g. +253." autoComplete="off" />
          <Select
            label="Account status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as CustomerStatus)}
            options={STATUS_OPTIONS}
            help={form.status === 'blocked' ? 'Blocked customers can’t sign in or place orders.' : form.status === 'inactive' ? 'Inactive accounts are excluded from marketing.' : undefined}
          />
          <div className="rounded-xl border border-zinc-200 p-4">
            <Toggle
              label="Marketing opt-in"
              description="Customer agreed to receive promotional emails and SMS."
              checked={form.marketingOptIn}
              onChange={(v) => set('marketingOptIn', v)}
            />
          </div>
          <Textarea
            label="Internal notes"
            optional
            rows={4}
            maxLength={500}
            showCount
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Visible to staff only — preferences, VIP context, delivery instructions…"
          />
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Drawer>
  );
}
