import { useEffect, useState, type FormEvent } from 'react';
import { Lock, Mail, Phone, User } from 'lucide-react';
import type { AdminUser } from '@/types';
import { Button } from '@/components/common';
import { FormGrid, FormSection, Input } from '@/components/forms';
import { profileService } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { handleFormError } from '@/components/settings/formErrors';
import { isEmail, isPhone } from '@/utils/validation';

interface FormState {
  name: string;
  email: string;
  phone: string;
  currentPassword: string;
}
type Errors = Partial<Record<keyof FormState, string>>;

const FIELDS = ['name', 'email', 'phone', 'currentPassword'] as const;
const ALIAS = { firstName: 'name', lastName: 'name' };

const fromUser = (u: AdminUser): FormState => ({ name: u.name, email: u.email, phone: u.phone ?? '', currentPassword: '' });

/** PATCH /users/me — changing the sign-in email requires the current password. */
export function EditProfileForm({ user }: { user: AdminUser }) {
  const updateSession = useAuthStore((s) => s.updateSession);
  const [form, setForm] = useState<FormState>(() => fromUser(user));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(fromUser(user)), [user]);

  const initial = fromUser(user);
  const emailChanged = form.email.trim().toLowerCase() !== initial.email.toLowerCase();
  const dirty = form.name !== initial.name || emailChanged || form.phone !== initial.phone;

  const set = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    if (form.name.trim().length < 2) errs.name = 'Enter your full name.';
    if (!isEmail(form.email)) errs.email = 'Enter a valid email address.';
    if (form.phone.trim() && !isPhone(form.phone)) errs.phone = 'Enter a valid phone number, e.g. +253 77 12 34 56.';
    if (emailChanged && !form.currentPassword) errs.currentPassword = 'Enter your current password to change your email.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const saved = await profileService.update({ name: form.name, email: form.email, phone: form.phone, currentPassword: form.currentPassword || undefined }, user);
      updateSession({ user: { ...user, name: saved.name, email: saved.email, phone: saved.phone, avatarUrl: saved.avatarUrl } });
      setForm((f) => ({ ...f, currentPassword: '' }));
      toast.success('Profile updated.', emailChanged ? { description: `Sign in with ${saved.email} from now on.` } : undefined);
    } catch (err) {
      setErrors(handleFormError(err, 'Couldn’t update your profile.', { alias: ALIAS, fields: FIELDS }) as Errors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSection id="profile-details" title="Edit profile" description="Your name and contact details as other admins see them.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Input label="Full name" required icon={User} value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoComplete="name" maxLength={160} help="First name, then last name." />
        <FormGrid cols={2}>
          <Input label="Work email" required type="email" icon={Mail} value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} autoComplete="email" help="Used to sign in and for security alerts." />
          <Input label="Phone" optional type="tel" icon={Phone} value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} autoComplete="tel" placeholder="+253 77 00 00 00" />
        </FormGrid>
        {emailChanged && (
          <Input
            label="Current password"
            required
            type="password"
            icon={Lock}
            value={form.currentPassword}
            onChange={(e) => set('currentPassword', e.target.value)}
            error={errors.currentPassword}
            autoComplete="current-password"
            help="Required to change the email you sign in with."
          />
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            disabled={!dirty || saving}
            onClick={() => {
              setForm(initial);
              setErrors({});
            }}
          >
            Reset
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            Save profile
          </Button>
        </div>
      </form>
    </FormSection>
  );
}
