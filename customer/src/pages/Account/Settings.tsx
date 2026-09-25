import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { AccountSection } from '@/components/account/AccountLayout';
import { Button, Switch, TextField } from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { authService, errorMessage } from '@/services';
import { toast } from '@/store/toastStore';
import { email, password as passwordRule, phone, required, validate } from '@/utils/validation';

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border border-paper-200 bg-white">
      <div className="border-b border-paper-200 px-5 py-4 sm:px-6">
        <h2 className="heading-sm">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      <div className="px-5 py-6 sm:px-6">{children}</div>
    </section>
  );
}

function ProfileForm() {
  const { user, setUser } = useAuth();
  const [values, setValues] = useState({ firstName: user!.firstName, lastName: user!.lastName, email: user!.email, phone: user!.phone });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});
  const [saving, setSaving] = useState(false);
  const dirty = (Object.keys(values) as (keyof typeof values)[]).some((k) => values[k] !== user![k]);

  const bind = (k: keyof typeof values) => ({
    value: values[k],
    error: errors[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [k]: e.target.value }));
      setErrors((x) => ({ ...x, [k]: undefined }));
    },
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(values, { firstName: required('Enter your first name'), lastName: required('Enter your last name'), email, phone });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const updated = await authService.updateProfile(user!.id, values);
      setUser(updated);
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Could not update profile', { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <TextField label="First name" autoComplete="given-name" {...bind('firstName')} />
      <TextField label="Last name" autoComplete="family-name" {...bind('lastName')} />
      <TextField label="Email" type="email" autoComplete="email" {...bind('email')} />
      <TextField label="Phone" type="tel" autoComplete="tel" {...bind('phone')} />
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { user } = useAuth();
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(values, {
      current: required('Enter your current password'),
      next: passwordRule,
      confirm: (v) => (v !== values.next ? 'Passwords do not match' : undefined),
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await authService.changePassword(user!.id, values.current, values.next);
      toast.success('Password changed');
      setValues({ current: '', next: '', confirm: '' });
    } catch (err) {
      setErrors({ current: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:max-w-md">
      <TextField label="Current password" type="password" autoComplete="current-password" value={values.current} onChange={set('current')} error={errors.current} />
      <TextField label="New password" type="password" autoComplete="new-password" value={values.next} onChange={set('next')} error={errors.next} hint="At least 8 characters with letters and numbers." />
      <TextField label="Confirm new password" type="password" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} error={errors.confirm} />
      <div>
        <Button type="submit" variant="primary" loading={saving}>
          Update password
        </Button>
      </div>
    </form>
  );
}

function Preferences() {
  const { user, setUser } = useAuth();
  const [marketing, setMarketing] = useState(user!.marketingOptIn);
  const [orderSms, setOrderSms] = useState(true);

  const toggleMarketing = async (next: boolean) => {
    setMarketing(next);
    try {
      const updated = await authService.updateProfile(user!.id, { marketingOptIn: next });
      setUser(updated);
      toast.success(next ? 'Subscribed to SPORTX news' : 'Unsubscribed from marketing emails');
    } catch (err) {
      setMarketing(!next);
      toast.error('Could not update preferences', { description: errorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <Switch checked={marketing} onChange={toggleMarketing} label="News & offers" description="New releases, limited drops and member-only offers by email." />
      <div className="divider" />
      <Switch checked={orderSms} onChange={setOrderSms} label="Order updates by SMS" description="Delivery notifications to your phone." />
    </div>
  );
}

export default function SettingsPage() {
  usePageMeta({ title: 'Profile Settings', noindex: true });
  return (
    <AccountSection title="Profile settings" description="Manage your personal details, password and communication preferences.">
      <div className="space-y-6">
        <Card title="Personal details">
          <ProfileForm />
        </Card>
        <Card title="Password" description="Use a strong password you don’t use elsewhere.">
          <PasswordForm />
        </Card>
        <Card title="Communication preferences">
          <Preferences />
        </Card>
      </div>
    </AccountSection>
  );
}
