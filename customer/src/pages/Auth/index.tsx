import { ArrowLeft, Check, MailCheck, X } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, Checkbox, InlineAlert, TextField } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { IMG } from '@/data/images';
import { DEMO_CREDENTIALS } from '@/data/mockSeed';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { authService, errorMessage } from '@/services';
import { USE_MOCK_API } from '@/services/config';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';
import { email, password as passwordRule, passwordStrength, phone, required, validate } from '@/utils/validation';
import { AuthShell } from './AuthShell';

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
  usePageMeta({ title: 'Sign in', noindex: true });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useForm({ email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form.values, { email, password: required('Enter your password') });
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setError(null);
    try {
      const user = await login({ ...form.values, remember });
      toast.success(`Welcome back, ${user.firstName}`);
      navigate(safeRedirect(params.get('redirect')), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to SPORTX."
      footer={
        <p>
          New to SPORTX?{' '}
          <Link to={`${ROUTES.register}${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect') as string)}` : ''}`} className="font-semibold text-ink underline underline-offset-4">
            Create an account
          </Link>
        </p>
      }
    >
      {USE_MOCK_API && (
        <InlineAlert className="mb-6">
          Demo account: <strong className="font-semibold">{DEMO_CREDENTIALS.email}</strong> / <strong className="font-semibold">{DEMO_CREDENTIALS.password}</strong>
        </InlineAlert>
      )}
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" {...form.bind('email')} />
        <TextField label="Password" type="password" autoComplete="current-password" {...form.bind('password')} />
        <div className="flex items-center justify-between gap-4">
          <Checkbox label="Remember me" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Link to={ROUTES.forgotPassword} className="text-sm font-medium underline underline-offset-4 hover:text-accent-dark">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} loadingText="Signing in…">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

// ───────────────────────────── Register ─────────────────────────────

function PasswordMeter({ value }: { value: string }) {
  const { score, label } = passwordStrength(value);
  const rules = [
    { ok: value.length >= 8, text: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(value) && /\d/.test(value), text: 'Letters and numbers' },
    { ok: /[A-Z]/.test(value) && /[a-z]/.test(value), text: 'Upper and lower case' },
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
        Strength: <span className="font-semibold text-ink">{label}</span>
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
  usePageMeta({ title: 'Create account', noindex: true });
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useForm({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' });
  const [terms, setTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form.values, {
      firstName: required('Enter your first name'),
      lastName: required('Enter your last name'),
      email,
      phone,
      password: passwordRule,
      confirm: (v) => (!v ? 'Confirm your password' : v !== form.values.password ? 'Passwords do not match' : undefined),
    });
    form.setErrors(errs);
    setTermsError(terms ? null : 'Please accept the terms to continue');
    if (Object.keys(errs).length || !terms) return;
    setLoading(true);
    setError(null);
    try {
      const { confirm: _confirm, ...payload } = form.values;
      const user = await register(payload);
      toast.success(`Welcome to SPORTX, ${user.firstName}`, { description: 'Your account is ready.' });
      navigate(safeRedirect(params.get('redirect')), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Join SPORTX"
      subtitle="Create your account in under a minute."
      image={IMG.runBlocks}
      footer={
        <p>
          Already have an account?{' '}
          <Link to={ROUTES.login} className="font-semibold text-ink underline underline-offset-4">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="First name" autoComplete="given-name" {...form.bind('firstName')} />
          <TextField label="Last name" autoComplete="family-name" {...form.bind('lastName')} />
        </div>
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" {...form.bind('email')} />
        <TextField label="Phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+253" {...form.bind('phone')} />
        <div>
          <TextField label="Password" type="password" autoComplete="new-password" {...form.bind('password')} />
          <PasswordMeter value={form.values.password} />
        </div>
        <TextField label="Confirm password" type="password" autoComplete="new-password" {...form.bind('confirm')} />
        <div>
          <Checkbox
            checked={terms}
            onChange={(e) => {
              setTerms(e.target.checked);
              setTermsError(null);
            }}
            label={
              <>
                I agree to the{' '}
                <Link to={ROUTES.terms} className="underline underline-offset-2">
                  Terms
                </Link>{' '}
                and{' '}
                <Link to={ROUTES.privacy} className="underline underline-offset-2">
                  Privacy Policy
                </Link>
              </>
            }
          />
          {termsError && <p className="field-error">{termsError}</p>}
        </div>
        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} loadingText="Creating account…">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}

// ───────────────────────────── Forgot / Reset ─────────────────────────────

export function ForgotPasswordPage() {
  usePageMeta({ title: 'Reset your password', noindex: true });
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
      form.setErrors({ email: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your inbox">
        <div className="flex gap-4">
          <MailCheck className="h-8 w-8 shrink-0 text-success" strokeWidth={1.5} aria-hidden />
          <p className="text-ink-600">
            If an account exists for <strong className="font-semibold text-ink">{form.values.email}</strong>, you’ll receive a link to reset your password within a few minutes.
          </p>
        </div>
        {USE_MOCK_API && (
          <InlineAlert className="mt-6">
            Demo mode: no email is sent.{' '}
            <Link to={`${ROUTES.resetPassword}?token=demo`} className="font-semibold underline underline-offset-2">
              Open the reset page
            </Link>
          </InlineAlert>
        )}
        <ButtonLink to={ROUTES.login} variant="outline" size="lg" fullWidth className="mt-8" leftIcon={<ArrowLeft className="h-4 w-4" />}>
          Back to sign in
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot password" subtitle="Enter your email and we’ll send you a link to reset your password.">
      <form onSubmit={submit} noValidate className="space-y-5">
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" {...form.bind('email')} />
        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          Send reset link
        </Button>
        <Link to={ROUTES.login} className="flex items-center justify-center gap-2 text-sm font-medium hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  usePageMeta({ title: 'Choose a new password', noindex: true });
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const form = useForm({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'This reset link is invalid or has expired. Request a new one below.');
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form.values, {
      password: passwordRule,
      confirm: (v) => (v !== form.values.password ? 'Passwords do not match' : undefined),
    });
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setError(null);
    try {
      await authService.resetPassword(token, form.values.password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Password updated">
        <p className="text-ink-600">Your password has been changed. You can now sign in with your new password.</p>
        <ButtonLink to={ROUTES.login} variant="primary" size="lg" fullWidth className="mt-8">
          Sign in
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="New password" subtitle="Choose a strong password you haven’t used before.">
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && (
          <InlineAlert tone="error">
            {error}{' '}
            {!token && (
              <Link to={ROUTES.forgotPassword} className="font-semibold underline">
                Request a new link
              </Link>
            )}
          </InlineAlert>
        )}
        <div>
          <TextField label="New password" type="password" autoComplete="new-password" {...form.bind('password')} disabled={!token} />
          <PasswordMeter value={form.values.password} />
        </div>
        <TextField label="Confirm new password" type="password" autoComplete="new-password" {...form.bind('confirm')} disabled={!token} />
        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} disabled={!token}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
