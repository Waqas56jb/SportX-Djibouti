import { AlertTriangle, Camera, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountSection } from '@/components/account/AccountLayout';
import { Button, InlineAlert, Modal, Switch, TextField } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { accountService } from '@/services/accountService';
import { ApiError } from '@/services/api';
import { apiFieldErrors, friendlyError } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import type { ProfileUpdate } from '@/types';
import { initials } from '@/utils/format';
import { email, password as passwordRule, phone, required, validate } from '@/utils/validation';

const MAX_AVATAR_MB = 5;

function Card({ title, description, children, tone }: { title: string; description?: string; children: ReactNode; tone?: 'danger' }) {
  return (
    <section className={tone === 'danger' ? 'border border-danger/30 bg-white' : 'border border-paper-200 bg-white'}>
      <div className="border-b border-paper-200 px-5 py-4 sm:px-6">
        <h2 className={tone === 'danger' ? 'heading-sm text-danger' : 'heading-sm'}>{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      <div className="px-5 py-6 sm:px-6">{children}</div>
    </section>
  );
}

/** Wrong-password errors come back as UNAUTHORIZED / VALIDATION_ERROR on the password field. */
const passwordError = (err: unknown, field: string) => {
  const fields = apiFieldErrors(err);
  if (fields[field]) return fields[field];
  if (err instanceof ApiError && (err.code === 'UNAUTHORIZED' || err.code === 'VALIDATION_ERROR') && /password/i.test(err.message)) return err.message;
  return undefined;
};

function AvatarCard() {
  const { user, setUser } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file', { description: 'JPG, PNG or WebP work best.' });
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) return toast.error('Image is too large', { description: `Choose a photo under ${MAX_AVATAR_MB} MB.` });
    setBusy('upload');
    try {
      setUser(await accountService.uploadAvatar(file));
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error('Could not upload photo', { description: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    try {
      setUser(await accountService.removeAvatar());
      toast.success('Profile photo removed');
    } catch (err) {
      toast.error('Could not remove photo', { description: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      {user!.avatarUrl ? (
        <img src={user!.avatarUrl} alt="Your profile photo" className="h-20 w-20 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-ink font-display text-2xl font-bold text-white" aria-hidden>
          {initials(user!.firstName, user!.lastName)}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={upload} tabIndex={-1} aria-hidden />
        <Button variant="outline" size="sm" loading={busy === 'upload'} disabled={busy !== null} onClick={() => input.current?.click()} leftIcon={<Camera className="h-4 w-4" />}>
          {user!.avatarUrl ? 'Change photo' : 'Upload photo'}
        </Button>
        {user!.avatarUrl && (
          <Button variant="ghost" size="sm" loading={busy === 'remove'} disabled={busy !== null} onClick={remove} leftIcon={<Trash2 className="h-4 w-4" />} className="hover:text-danger">
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function ProfileForm() {
  const { user, setUser } = useAuth();
  const initial = { firstName: user!.firstName, lastName: user!.lastName, email: user!.email, phone: user!.phone ?? '' };
  const [values, setValues] = useState(initial);
  const [currentPassword, setCurrentPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values | 'currentPassword', string>>>({});
  const [saving, setSaving] = useState(false);
  const dirty = (Object.keys(values) as (keyof typeof values)[]).some((k) => values[k].trim() !== (user![k] ?? '').trim());
  const emailChanged = values.email.trim().toLowerCase() !== user!.email.toLowerCase();

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
    const errs: typeof errors = validate(values, {
      firstName: required('Enter your first name'),
      lastName: required('Enter your last name'),
      email,
      phone: (v) => (v.trim() ? phone(v) : undefined),
    });
    if (emailChanged && !currentPassword) errs.currentPassword = 'Enter your current password to change your email';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const patch: ProfileUpdate = {};
    (Object.keys(values) as (keyof typeof values)[]).forEach((k) => {
      if (values[k].trim() !== (user![k] ?? '').trim()) patch[k] = values[k].trim();
    });
    if (emailChanged) patch.currentPassword = currentPassword;
    setSaving(true);
    try {
      const updated = await accountService.updateProfile(patch);
      setUser(updated);
      setValues({ firstName: updated.firstName, lastName: updated.lastName, email: updated.email, phone: updated.phone ?? '' });
      setCurrentPassword('');
      toast.success('Profile updated', emailChanged && updated.emailVerified === false ? { description: 'Check your inbox to verify your new email address.' } : undefined);
    } catch (err) {
      const fields = apiFieldErrors(err);
      const pwd = passwordError(err, 'currentPassword');
      if (err instanceof ApiError && err.code === 'CONFLICT') fields.email = 'That email is already used by another account.';
      setErrors({ ...fields, ...(pwd ? { currentPassword: pwd } : {}) });
      if (!Object.keys(fields).length && !pwd) toast.error('Could not update profile', { description: friendlyError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <TextField label="First name" autoComplete="given-name" {...bind('firstName')} />
      <TextField label="Last name" autoComplete="family-name" {...bind('lastName')} />
      <TextField label="Email" type="email" autoComplete="email" {...bind('email')} />
      <TextField label="Phone" type="tel" autoComplete="tel" optional {...bind('phone')} />
      {emailChanged && (
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            setErrors((x) => ({ ...x, currentPassword: undefined }));
          }}
          error={errors.currentPassword}
          hint="Required to change the email on your account."
          containerClassName="sm:col-span-2 sm:max-w-sm"
        />
      )}
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(values, {
      current: required('Enter your current password'),
      next: (v) => passwordRule(v) ?? (v === values.current ? 'Choose a password different from the current one' : undefined),
      confirm: (v) => (v !== values.next ? 'Passwords do not match' : undefined),
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await accountService.changePassword(values.current, values.next);
      toast.success('Password changed', { description: 'Other devices have been signed out.' });
      setValues({ current: '', next: '', confirm: '' });
    } catch (err) {
      const fields = apiFieldErrors(err);
      if (fields.newPassword) setErrors({ next: fields.newPassword });
      else setErrors({ current: passwordError(err, 'currentPassword') ?? friendlyError(err) });
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
      <TextField label="New password" type="password" autoComplete="new-password" value={values.next} onChange={set('next')} error={errors.next} hint="At least 8 characters, including a letter and a number." />
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
  const [saving, setSaving] = useState(false);

  const toggleMarketing = async (next: boolean) => {
    if (saving) return;
    setMarketing(next);
    setSaving(true);
    try {
      setUser(await accountService.updateProfile({ marketingOptIn: next }));
      toast.success(next ? 'Subscribed to SPORTX news' : 'Unsubscribed from marketing emails');
    } catch (err) {
      setMarketing(!next);
      toast.error('Could not update preferences', { description: friendlyError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Switch checked={marketing} onChange={toggleMarketing} label="News & offers" description="New releases, limited drops and member-only offers by email." />
      <p className="text-xs text-ink-500">Order, delivery and support updates are always sent and appear in your notifications.</p>
    </div>
  );
}

function DeleteAccount() {
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setConfirmText('');
    setError(undefined);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError('Enter your password');
    setBusy(true);
    try {
      await accountService.deleteAccount(password);
      clear();
      toast.success('Your account has been deleted', { description: 'We’re sorry to see you go.' });
      navigate(ROUTES.home, { replace: true });
    } catch (err) {
      setError(passwordError(err, 'password') ?? friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-lg text-sm text-ink-600">Permanently delete your SPORTX account, saved addresses, wishlist and preferences. Order records are kept as required for accounting.</p>
        <Button variant="outline" onClick={() => setOpen(true)} className="shrink-0 !border-danger !text-danger hover:!bg-danger hover:!text-white" leftIcon={<Trash2 className="h-4 w-4" />}>
          Delete account
        </Button>
      </div>
      <Modal open={open} onClose={close} title="Delete your account?" size="sm">
        <form onSubmit={submit} noValidate>
          <div className="space-y-5 px-5 py-6 sm:px-6">
            <InlineAlert tone="error">
              <span className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> This can’t be undone. You will be signed out on every device.
              </span>
            </InlineAlert>
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(undefined);
              }}
              error={error}
            />
            <TextField label='Type "DELETE" to confirm' value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-paper-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy} disabled={confirmText.trim().toUpperCase() !== 'DELETE'} className="!bg-danger !border-danger">
              Delete permanently
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function SettingsPage() {
  usePageMeta({ title: 'Profile Settings', noindex: true });
  const { user } = useAuth();
  return (
    <AccountSection title="Profile settings" description="Manage your personal details, password and communication preferences.">
      <div className="space-y-6">
        {user?.emailVerified === false && (
          <InlineAlert tone="warning">Your email address is not verified yet. Check your inbox for the verification link.</InlineAlert>
        )}
        <Card title="Profile photo">
          <AvatarCard />
        </Card>
        <Card title="Personal details">
          <ProfileForm />
        </Card>
        <Card title="Password" description="Use a strong password you don’t use elsewhere.">
          <PasswordForm />
        </Card>
        <Card title="Communication preferences">
          <Preferences />
        </Card>
        <Card title="Delete account" tone="danger">
          <DeleteAccount />
        </Card>
      </div>
    </AccountSection>
  );
}
