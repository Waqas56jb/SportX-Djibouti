import { ArrowLeft, Check, MailCheck, ShieldAlert, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, Checkbox, InlineAlert, TextField } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { IMG } from '@/data/images';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useT } from '@/i18n';
import { ApiError } from '@/services/api';
import { apiFieldErrors, authService, friendlyError } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';
import { email, password as passwordRule, passwordStrength, phone, required, validate } from '@/utils/validation';
import { authLinkToken } from '@/utils/authLink';
import { AuthShell } from './AuthShell';

export const VERIFY_EMAIL_PATH = '/verify-email';

const safeRedirect = (value: string | null) => (value && value.startsWith('/') && !value.startsWith('//') ? value : ROUTES.account);

function useForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const bind = (key: keyof T) => ({
    value: values[key],
    error: errors[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
    },
  });
  return { values, errors, setErrors, bind };
}

// ───────────────────────────── Login ─────────────────────────────

export function LoginPage() {
  const { t } = useT();
  usePageMeta({ title: t('auth.meta.signIn'), noindex: true });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useForm({ email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form.values, { email, password: required(t('auth.validation.enterPassword')) });
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setError(null);
    setUnverified(false);
    try {
      const user = await login({ ...form.values, remember });
      toast.success(t('auth.login.welcome', { name: user.firstName }));
      navigate(safeRedirect(params.get('redirect')), { replace: true });
    } catch (err) {
      const fields = apiFieldErrors(err);
      if (Object.keys(fields).length) form.setErrors(fields);
      setUnverified(err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED');
      setError(friendlyError(err));
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <p>
          {t('auth.login.newHere')}{' '}
          <Link to={`${ROUTES.register}${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect') as string)}` : ''}`} className="font-semibold text-ink underline underline-offset-4">
            {t('auth.login.createAccount')}
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && (
          <InlineAlert tone="error">
            {error}
            {unverified && (
              <>
                {' '}
                <Link to={`${VERIFY_EMAIL_PATH}?email=${encodeURIComponent(form.values.email.trim())}`} className="font-semibold underline underline-offset-2">
                  {t('auth.login.resendVerification')}
                </Link>
              </>
            )}
          </InlineAlert>
        )}
        <TextField label={t('auth.fields.email')} type="email" dir="ltr" inputMode="email" autoComplete="email" {...form.bind('email')} />
        <TextField label={t('auth.fields.password')} type="password" dir="ltr" autoComplete="current-password" {...form.bind('password')} />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <Checkbox label={t('auth.login.remember')} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Link to={ROUTES.forgotPassword} className="text-sm font-medium underline underline-offset-4 hover:text-accent-dark">
            {t('auth.login.forgot')}
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} loadingText={t('auth.login.submitting')}>
          {t('common.actions.signIn')}
        </Button>
      </form>
    </AuthShell>
  );
}

// ───────────────────────────── Register ─────────────────────────────

function PasswordMeter({ value }: { value: string }) {
  const { t } = useT();
  const { score, label } = passwordStrength(value);
  const rules = [
    { ok: value.length >= 8, text: t('auth.password.ruleLength') },
    { ok: /[A-Za-z]/.test(value) && /\d/.test(value), text: t('auth.password.ruleLettersNumbers') },
    { ok: /[A-Z]/.test(value) && /[a-z]/.test(value), text: t('auth.password.ruleCase') },
  ];
  if (!value) return null;
  return (
    <div className="mt-3" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-1 flex-1 transition-colors', i <= score ? (score <= 1 ? 'bg-danger' : score === 2 ? 'bg-warning' : 'bg-success') : 'bg-paper-200')} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-500">
        {t('auth.password.strength')} <span className="font-semibold text-ink">{label}</span>
      </p>
      <ul className="mt-2 space-y-1">
        {rules.map((r) => (
          <li key={r.text} className={cn('flex items-center gap-1.5 text-xs', r.ok ? 'text-success' : 'text-ink-500')}>
            {r.ok ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />} {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RegisterPage() {
  const { t } = useT();
  usePageMeta({ title: t('auth.meta.register'), noindex: true });
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useForm({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' });
  const [terms, setTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyEmailFor, setVerifyEmailFor] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form.values, {
      firstName: required(t('auth.validation.enterFirstName')),
      lastName: required(t('auth.validation.enterLastName')),
      email,
      phone: (v) => (v.trim() ? phone(v) : undefined),
      password: passwordRule,
      confirm: (v) => (!v ? t('auth.validation.confirmPassword') : v !== form.values.password ? t('auth.validation.passwordMismatch') : undefined),
    });
    form.setErrors(errs);
    setTermsError(terms ? null : t('auth.register.acceptTerms'));
    if (Object.keys(errs).length || !terms) return;
    setLoading(true);
    setError(null);
    try {
      const { confirm: _confirm, ...payload } = form.values;
      const result = await register({ ...payload, marketingOptIn: marketing });
      if (result.requiresEmailVerification) {
        setVerifyEmailFor(result.user.email);
        return;
      }
      toast.success(t('auth.register.welcome', { name: result.user.firstName }), { description: t('auth.register.ready') });
      navigate(safeRedirect(params.get('redirect')), { replace: true });
    } catch (err) {
      const fields = apiFieldErrors(err);
      if (err instanceof ApiError && err.code === 'CONFLICT') fields.email = t('auth.register.emailExists');
      form.setErrors(fields);
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  if (verifyEmailFor) {
    return (
      <AuthShell title={t('auth.register.verifyTitle')}>
        <div className="flex gap-4">
          <MailCheck className="h-8 w-8 shrink-0 text-success" strokeWidth={1.5} aria-hidden />
          <p className="min-w-0 text-ink-600">
            {t('auth.register.verifyBodyBefore')} <strong className="ltr-text break-all font-semibold text-ink">{verifyEmailFor}</strong> {t('auth.register.verifyBodyAfter')}
          </p>
        </div>
        <ButtonLink to={ROUTES.login} variant="primary" size="lg" fullWidth className="mt-8">
          {t('auth.register.goToSignIn')}
        </ButtonLink>
        <ResendVerification email={verifyEmailFor} className="mt-4" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      image={IMG.stadiumNight}
      footer={
        <p>
          {t('auth.register.haveAccount')}{' '}
          <Link to={ROUTES.login} className="font-semibold text-ink underline underline-offset-4">
            {t('common.actions.signIn')}
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label={t('auth.fields.firstName')} autoComplete="given-name" {...form.bind('firstName')} />
          <TextField label={t('auth.fields.lastName')} autoComplete="family-name" {...form.bind('lastName')} />
        </div>
        <TextField label={t('auth.fields.email')} type="email" dir="ltr" inputMode="email" autoComplete="email" {...form.bind('email')} />
        <TextField
          label={t('auth.fields.phone')}
          type="tel"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t('auth.fields.phonePlaceholder')}
          optional
          {...form.bind('phone')}
        />
        <div>
          <TextField label={t('auth.fields.password')} type="password" dir="ltr" autoComplete="new-password" {...form.bind('password')} />
          <PasswordMeter value={form.values.password} />
        </div>
        <TextField label={t('auth.fields.confirmPassword')} type="password" dir="ltr" autoComplete="new-password" {...form.bind('confirm')} />
        <div>
          <Checkbox
            checked={terms}
            onChange={(e) => {
              setTerms(e.target.checked);
              setTermsError(null);
            }}
            label={
              <>
                {t('auth.register.agreeBefore')}{' '}
                <Link to={ROUTES.terms} className="underline underline-offset-2">
                  {t('auth.register.agreeTerms')}
                </Link>{' '}
                {t('auth.register.agreeAnd')}{' '}
                <Link to={ROUTES.privacy} className="underline underline-offset-2">
                  {t('auth.register.agreePrivacy')}
                </Link>
              </>
            }
          />
          {termsError && <p className="field-error">{termsError}</p>}
        </div>
        <Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)} label={t('auth.register.marketing')} />
        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} loadingText={t('auth.register.submitting')}>
          {t('common.actions.createAccount')}
        </Button>
      </form>
    </AuthShell>
  );
}

// ───────────────────────────── Forgot / Reset ─────────────────────────────

export function ForgotPasswordPage() {
  const { t } = useT();
  usePageMeta({ title: t('auth.meta.forgot'), noindex: true });
  const form = useForm({ email: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form.values, { email });
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      await authService.requestPasswordReset(form.values.email);
      setSent(true);
    } catch (err) {
      form.setErrors({ email: apiFieldErrors(err).email ?? friendlyError(err) });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title={t('auth.forgot.sentTitle')}>
        <div className="flex gap-4">
          <MailCheck className="h-8 w-8 shrink-0 text-success" strokeWidth={1.5} aria-hidden />
          <p className="min-w-0 text-ink-600">
            {t('auth.forgot.sentBefore')} <strong className="ltr-text break-all font-semibold text-ink">{form.values.email}</strong>
            {t('auth.forgot.sentAfter')}
          </p>
        </div>
        <ButtonLink to={ROUTES.login} variant="outline" size="lg" fullWidth className="mt-8" leftIcon={<ArrowLeft className="h-4 w-4" />}>
          {t('auth.forgot.backToSignIn')}
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <TextField label={t('auth.fields.email')} type="email" dir="ltr" inputMode="email" autoComplete="email" {...form.bind('email')} />
        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          {t('auth.forgot.submit')}
        </Button>
        <Link to={ROUTES.login} className="flex items-center justify-center gap-2 text-sm font-medium hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t('auth.forgot.backToSignIn')}
        </Link>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { t } = useT();
  usePageMeta({ title: t('auth.meta.reset'), noindex: true });
  const [params] = useSearchParams();
  const token = authLinkToken(params);
  const form = useForm({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : t('auth.reset.invalidLink'));
  const [linkInvalid, setLinkInvalid] = useState(!token);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form.values, {
      password: passwordRule,
      confirm: (v) => (v !== form.values.password ? t('auth.validation.passwordMismatch') : undefined),
    });
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setError(null);
    try {
      await authService.resetPassword(token, form.values.password);
      setDone(true);
    } catch (err) {
      const fields = apiFieldErrors(err);
      if (fields.password) form.setErrors({ password: fields.password });
      const invalid = err instanceof ApiError && !fields.password && Boolean(fields.token || err.status === 400 || err.status === 401 || err.status === 404);
      setLinkInvalid(invalid);
      setError(invalid ? t('auth.reset.invalidLink') : friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell title={t('auth.reset.doneTitle')}>
        <p className="text-ink-600">{t('auth.reset.doneBody')}</p>
        <ButtonLink to={ROUTES.login} variant="primary" size="lg" fullWidth className="mt-8">
          {t('common.actions.signIn')}
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && (
          <InlineAlert tone="error">
            {error}{' '}
            {(!token || linkInvalid) && (
              <Link to={ROUTES.forgotPassword} className="font-semibold underline">
                {t('auth.reset.requestNew')}
              </Link>
            )}
          </InlineAlert>
        )}
        <div>
          <TextField label={t('auth.fields.newPassword')} type="password" dir="ltr" autoComplete="new-password" {...form.bind('password')} disabled={!token} />
          <PasswordMeter value={form.values.password} />
        </div>
        <TextField label={t('auth.fields.confirmNewPassword')} type="password" dir="ltr" autoComplete="new-password" {...form.bind('confirm')} disabled={!token} />
        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} disabled={!token}>
          {t('auth.reset.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}

// ───────────────────────────── Email verification ─────────────────────────────

/** "Resend the email" helper shared by the register success state and the verify page. */
function ResendVerification({ email: initialEmail, className }: { email?: string; className?: string }) {
  const { t } = useT();
  const [value, setValue] = useState(initialEmail ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | undefined>();

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = email(value);
    if (invalid) return setError(invalid);
    setState('sending');
    setError(undefined);
    try {
      await authService.resendVerification(value);
      setState('sent');
    } catch (err) {
      setError(apiFieldErrors(err).email ?? friendlyError(err));
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <InlineAlert tone="success" className={className}>
        {t('auth.verify.resentBefore')} <strong className="ltr-text break-all font-semibold">{value}</strong> {t('auth.verify.resentAfter')}
      </InlineAlert>
    );
  }

  return (
    <form onSubmit={send} noValidate className={cn('space-y-3', className)}>
      {!initialEmail && (
        <TextField
          label={t('auth.fields.email')}
          type="email"
          dir="ltr"
          inputMode="email"
          autoComplete="email"
          value={value}
          error={error}
          onChange={(e) => (setValue(e.target.value), setError(undefined))}
        />
      )}
      {initialEmail && error && <p className="field-error">{error}</p>}
      <Button type="submit" variant="outline" size="lg" fullWidth loading={state === 'sending'}>
        {t('auth.verify.resend')}
      </Button>
    </form>
  );
}

export function VerifyEmailPage() {
  const { t } = useT();
  usePageMeta({ title: t('auth.meta.verify'), noindex: true });
  const [params] = useSearchParams();
  const token = authLinkToken(params);
  const [state, setState] = useState<'verifying' | 'done' | 'error'>(token ? 'verifying' : 'error');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authService
      .verifyEmail(token)
      .then((user) => {
        const current = useAuthStore.getState().session?.user;
        if (current && current.id === user.id) useAuthStore.getState().setUser({ ...current, ...user });
        setState('done');
      })
      .catch((err) => {
        setError(err instanceof ApiError && err.code !== 'RATE_LIMITED' && err.code !== 'NETWORK_ERROR' ? t('auth.verify.invalidLink') : friendlyError(err));
        setState('error');
      });
  }, [token, t]);

  if (state === 'verifying') {
    return (
      <AuthShell title={t('auth.verify.verifyingTitle')} subtitle={t('auth.verify.verifyingSubtitle')}>
        <div className="h-1 w-full overflow-hidden bg-paper-200">
          <div className="h-full w-1/3 animate-pulse bg-ink" />
        </div>
      </AuthShell>
    );
  }

  if (state === 'done') {
    const signedIn = Boolean(useAuthStore.getState().session);
    return (
      <AuthShell title={t('auth.verify.doneTitle')}>
        <div className="flex gap-4">
          <MailCheck className="h-8 w-8 shrink-0 text-success" strokeWidth={1.5} aria-hidden />
          <p className="text-ink-600">
            {t('auth.verify.doneBody')} {signedIn ? t('auth.verify.doneSignedIn') : t('auth.verify.doneSignedOut')}
          </p>
        </div>
        <ButtonLink to={signedIn ? ROUTES.account : ROUTES.login} variant="primary" size="lg" fullWidth className="mt-8">
          {signedIn ? t('auth.verify.goToAccount') : t('common.actions.signIn')}
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.verify.title')} subtitle={token ? undefined : t('auth.verify.subtitle')}>
      {error && (
        <InlineAlert tone="error" className="mb-6">
          <span className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {error} {t('auth.verify.requestBelow')}
            </span>
          </span>
        </InlineAlert>
      )}
      <ResendVerification email={params.get('email') ?? undefined} />
      <Link to={ROUTES.login} className="mt-6 flex items-center justify-center gap-2 text-sm font-medium hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t('auth.forgot.backToSignIn')}
      </Link>
    </AuthShell>
  );
}
