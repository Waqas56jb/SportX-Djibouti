import { AlertTriangle, Camera, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountSection } from '@/components/account/AccountLayout';
import { Button, InlineAlert, Modal, Switch, TextField } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { t, useT } from '@/i18n';
import { accountService } from '@/services/accountService';
import { ApiError } from '@/services/api';
import { apiFieldErrors, friendlyError, localizeApiMessage } from '@/services/authService';
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
  if (err instanceof ApiError && (err.code === 'UNAUTHORIZED' || err.code === 'VALIDATION_ERROR') && /password/i.test(err.message)) return localizeApiMessage(err.message);
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
    if (!file.type.startsWith('image/')) return toast.error(t('account.settings.notImage'), { description: t('account.settings.notImageBody') });
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) return toast.error(t('account.settings.tooLarge'), { description: t('account.settings.tooLargeBody', { size: MAX_AVATAR_MB }) });
    setBusy('upload');
    try {
      setUser(await accountService.uploadAvatar(file));
      toast.success(t('account.settings.photoUpdated'));
    } catch (err) {
      toast.error(t('account.settings.photoUploadError'), { description: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    try {
      setUser(await accountService.removeAvatar());
      toast.success(t('account.settings.photoRemoved'));
    } catch (err) {
      toast.error(t('account.settings.photoRemoveError'), { description: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      {user!.avatarUrl ? (
        <img src={user!.avatarUrl} alt={t('account.settings.avatarAlt')} className="h-20 w-20 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-ink font-display text-2xl font-bold text-white" aria-hidden>
          {initials(user!.firstName, user!.lastName)}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={upload} tabIndex={-1} aria-hidden />
        <Button variant="outline" size="sm" loading={busy === 'upload'} disabled={busy !== null} onClick={() => input.current?.click()} leftIcon={<Camera className="h-4 w-4" />}>
          {user!.avatarUrl ? t('account.settings.changePhoto') : t('account.settings.uploadPhoto')}
        </Button>
        {user!.avatarUrl && (
          <Button variant="ghost" size="sm" loading={busy === 'remove'} disabled={busy !== null} onClick={remove} leftIcon={<Trash2 className="h-4 w-4" />} className="hover:text-danger">
            {t('common.actions.remove')}
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
      firstName: required(t('auth.validation.enterFirstName')),
      lastName: required(t('auth.validation.enterLastName')),
      email,
      phone: (v) => (v.trim() ? phone(v) : undefined),
    });
    if (emailChanged && !currentPassword) errs.currentPassword = t('account.settings.currentPasswordForEmail');
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
      toast.success(t('account.settings.profileUpdated'), emailChanged && updated.emailVerified === false ? { description: t('account.settings.verifyNewEmail') } : undefined);
    } catch (err) {
      const fields = apiFieldErrors(err);
      const pwd = passwordError(err, 'currentPassword');
      if (err instanceof ApiError && err.code === 'CONFLICT') fields.email = t('account.settings.emailTaken');
      setErrors({ ...fields, ...(pwd ? { currentPassword: pwd } : {}) });
      if (!Object.keys(fields).length && !pwd) toast.error(t('account.settings.profileError'), { description: friendlyError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <TextField label={t('auth.fields.firstName')} autoComplete="given-name" {...bind('firstName')} />
      <TextField label={t('auth.fields.lastName')} autoComplete="family-name" {...bind('lastName')} />
      <TextField label={t('auth.fields.email')} type="email" dir="ltr" autoComplete="email" {...bind('email')} />
      <TextField label={t('auth.fields.phone')} type="tel" dir="ltr" autoComplete="tel" optional {...bind('phone')} />
      {emailChanged && (
        <TextField
          label={t('auth.fields.currentPassword')}
          type="password"
          dir="ltr"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            setErrors((x) => ({ ...x, currentPassword: undefined }));
          }}
          error={errors.currentPassword}
          hint={t('account.settings.currentPasswordHint')}
          containerClassName="sm:col-span-2 sm:max-w-sm"
        />
      )}
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
          {t('common.actions.saveChanges')}
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
      current: required(t('auth.validation.enterCurrentPassword')),
      next: (v) => passwordRule(v) ?? (v === values.current ? t('account.settings.passwordDifferent') : undefined),
      confirm: (v) => (v !== values.next ? t('auth.validation.passwordMismatch') : undefined),
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await accountService.changePassword(values.current, values.next);
      toast.success(t('account.settings.passwordChanged'), { description: t('account.settings.otherDevices') });
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
    <form onSubmit={submit} noValidate className="grid w-full gap-5 sm:max-w-md">
      <TextField label={t('auth.fields.currentPassword')} type="password" dir="ltr" autoComplete="current-password" value={values.current} onChange={set('current')} error={errors.current} />
      <TextField
        label={t('auth.fields.newPassword')}
        type="password"
        dir="ltr"
        autoComplete="new-password"
        value={values.next}
        onChange={set('next')}
        error={errors.next}
        hint={t('account.settings.passwordHint')}
      />
      <TextField label={t('auth.fields.confirmNewPassword')} type="password" dir="ltr" autoComplete="new-password" value={values.confirm} onChange={set('confirm')} error={errors.confirm} />
      <div>
        <Button type="submit" variant="primary" loading={saving}>
          {t('account.settings.updatePassword')}
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
      toast.success(next ? t('account.settings.subscribed') : t('account.settings.unsubscribed'));
    } catch (err) {
      setMarketing(!next);
      toast.error(t('account.settings.preferencesError'), { description: friendlyError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Switch checked={marketing} onChange={toggleMarketing} label={t('account.settings.newsLabel')} description={t('account.settings.newsDescription')} />
      <p className="text-xs text-ink-500">{t('account.settings.transactional')}</p>
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
  const confirmWord = t('account.settings.deleteConfirmWord');
  // English "DELETE" is always accepted too.
  const typed = confirmText.trim().toLocaleUpperCase();
  const confirmed = typed === confirmWord.toLocaleUpperCase() || typed === 'DELETE';

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setConfirmText('');
    setError(undefined);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError(t('auth.validation.enterPassword'));
    setBusy(true);
    try {
      await accountService.deleteAccount(password);
      clear();
      toast.success(t('account.settings.deleted'), { description: t('account.settings.deletedBody') });
      navigate(ROUTES.home, { replace: true });
    } catch (err) {
      setError(passwordError(err, 'password') ?? friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-lg text-sm text-ink-600">{t('account.settings.deleteBody')}</p>
        <Button variant="outline" onClick={() => setOpen(true)} className="shrink-0 !border-danger !text-danger hover:!bg-danger hover:!text-white" leftIcon={<Trash2 className="h-4 w-4" />}>
          {t('account.settings.deleteButton')}
        </Button>
      </div>
      <Modal open={open} onClose={close} title={t('account.settings.deleteModalTitle')} size="sm">
        <form onSubmit={submit} noValidate>
          <div className="space-y-5 px-5 py-6 sm:px-6">
            <InlineAlert tone="error">
              <span className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>{t('account.settings.deleteWarning')}</span>
              </span>
            </InlineAlert>
            <TextField
              label={t('auth.fields.password')}
              type="password"
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(undefined);
              }}
              error={error}
            />
            <TextField label={t('account.settings.deleteConfirmLabel', { word: confirmWord })} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-paper-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button variant="ghost" onClick={close} disabled={busy}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!confirmed} className="!bg-danger !border-danger">
              {t('account.settings.deletePermanently')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function SettingsPage() {
  useT();
  usePageMeta({ title: t('account.settings.meta'), noindex: true });
  const { user } = useAuth();
  return (
    <AccountSection title={t('account.settings.title')} description={t('account.settings.description')}>
      <div className="space-y-6">
        {user?.emailVerified === false && (
          <InlineAlert tone="warning">{t('account.settings.unverified')}</InlineAlert>
        )}
        <Card title={t('account.settings.photoTitle')}>
          <AvatarCard />
        </Card>
        <Card title={t('account.settings.personalTitle')}>
          <ProfileForm />
        </Card>
        <Card title={t('account.settings.passwordTitle')} description={t('account.settings.passwordDescription')}>
          <PasswordForm />
        </Card>
        <Card title={t('account.settings.preferencesTitle')}>
          <Preferences />
        </Card>
        <Card title={t('account.settings.deleteTitle')} tone="danger">
          <DeleteAccount />
        </Card>
      </div>
    </AccountSection>
  );
}
