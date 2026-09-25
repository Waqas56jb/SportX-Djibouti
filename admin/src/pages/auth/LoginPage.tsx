import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { Button } from '@/components/common/Button';
import { Wordmark } from '@/components/common/Misc';
import { Input } from '@/components/forms/Inputs';
import { Checkbox } from '@/components/forms/Choice';
import { Modal } from '@/components/modals/Overlay';
import { isEmail } from '@/utils/validation';
import { useDocumentTitle } from '@/hooks/misc';
import { BRAND } from '@/constants/brand';
import { appConfig } from '@/constants/config';
import { cn } from '@/utils/cn';

const DEMO_ACCOUNTS = [
  { email: 'admin@sportx.demo', role: 'Super Admin' },
  { email: 'store.manager@sportx.demo', role: 'Store Manager' },
  { email: 'products@sportx.demo', role: 'Product Manager' },
  { email: 'orders@sportx.demo', role: 'Order Manager' },
  { email: 'support@sportx.demo', role: 'Support Manager' },
];

function ForgotPasswordModal({ open, onClose, initialEmail }: { open: boolean; onClose: () => void; initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) return setError('Enter a valid email address.');
    setError('');
    setState('sending');
    await authService.requestPasswordReset(email);
    setState('sent');
  };
  const close = () => {
    setState('idle');
    onClose();
  };
  return (
    <Modal open={open} onClose={close} size="sm" title="Reset your password" description="We’ll email you a secure link to set a new password.">
      {state === 'sent' ? (
        <div className="py-4 text-center">
          <CheckCircle2 className="mx-auto text-emerald-500" size={36} aria-hidden />
          <p className="mt-3 text-sm font-medium text-zinc-900">Check your inbox</p>
          <p className="mt-1 text-[0.8125rem] text-zinc-500">If an admin account exists for {email}, a reset link is on its way. The link expires in 30 minutes.</p>
          <Button className="mt-5" onClick={close}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input label="Work email" type="email" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoComplete="email" data-autofocus />
          <Button type="submit" variant="primary" fullWidth loading={state === 'sending'}>
            Send reset link
          </Button>
        </form>
      )}
    </Modal>
  );
}

export default function LoginPage() {
  useDocumentTitle('Sign in');
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [forgotOpen, setForgotOpen] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!isEmail(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    else if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    setState('loading');
    try {
      await login({ email, password, remember });
      setState('success');
      setTimeout(() => navigate(from, { replace: true }), 450);
    } catch (err) {
      setState('idle');
      setFormError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    }
  };

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-ink-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 top-1/3 h-[520px] w-[520px] rotate-12 rounded-[96px] border border-white/[0.06]" />
          <div className="absolute -right-8 top-[42%] h-[380px] w-[380px] rotate-12 rounded-[72px] border border-white/[0.05]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-volt/40 to-transparent" />
          <div className="absolute inset-y-0 left-[58%] w-24 -skew-x-12 bg-volt/[0.035]" />
        </div>
        <div className="relative flex items-center gap-3">
          <Wordmark />
          <span className="mb-3 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-300">Admin</span>
        </div>
        <div className="relative">
          <p className="eyebrow !text-volt">Operations platform</p>
          <h1 className="mt-4 font-display text-[4.25rem] font-extrabold uppercase italic leading-[0.9] tracking-tight text-white xl:text-[5rem]">
            Move.
            <br />
            Train.
            <br />
            <span className="text-volt">Perform.</span>
          </h1>
          <p className="mt-6 max-w-md text-[0.9375rem] leading-relaxed text-zinc-400">Catalogue, inventory, orders, customers and marketing for the SPORTX store — in one control centre.</p>
        </div>
        <div className="relative flex items-end justify-between gap-6 text-xs text-zinc-500">
          <address className="not-italic leading-relaxed">
            {BRAND.addressLines.map((l) => (
              <div key={l}>{l}</div>
            ))}
            <div className="mt-1 text-zinc-400">{BRAND.phone}</div>
          </address>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-volt" aria-hidden /> Authorised staff only
          </span>
        </div>
      </aside>

      {/* Form */}
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <div className="inline-flex rounded-xl bg-ink-950 px-4 py-3">
              <Wordmark />
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Sign in to SPORTX Admin</h2>
          <p className="mt-1.5 text-sm text-zinc-500">Use your staff account to access the store back office.</p>

          {formError && (
            <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[0.8125rem] text-red-700">
              <AlertCircle size={16} className="mt-px shrink-0" aria-hidden />
              {formError}
            </div>
          )}
          {state === 'success' && (
            <div role="status" className="mt-6 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[0.8125rem] font-medium text-emerald-700">
              <CheckCircle2 size={16} aria-hidden /> Signed in. Loading your dashboard…
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            <Input
              label="Email"
              type="email"
              icon={Mail}
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
              }}
              error={errors.email}
              required
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPw ? 'text' : 'password'}
                icon={Lock}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
                }}
                error={errors.password}
                required
                inputClassName="pr-10"
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-2 top-[30px] rounded-md p-1.5 text-zinc-400 hover:text-zinc-700">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <Checkbox checked={remember} onChange={setRemember} label="Remember me" />
              <button type="button" onClick={() => setForgotOpen(true)} className="text-[0.8125rem] font-medium text-zinc-700 underline-offset-4 hover:text-zinc-950 hover:underline">
                Forgot password?
              </button>
            </div>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={state === 'loading'} disabled={state === 'success'} iconRight={state === 'idle' ? ArrowRight : undefined}>
              {state === 'loading' ? 'Signing in…' : state === 'success' ? 'Signed in' : 'Sign In'}
            </Button>
          </form>

          {appConfig.useMocks && (
            <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-800">Demo accounts</p>
                <p className="text-2xs text-zinc-500">
                  Password: <code className="rounded bg-white px-1 py-0.5 font-mono text-zinc-800 ring-1 ring-zinc-200">sportx2026</code>
                </p>
              </div>
              <p className="mt-1 text-2xs text-zinc-500">Each role sees a different menu — useful for reviewing permissions.</p>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.email}>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(a.email);
                        setPassword('sportx2026');
                        setErrors({});
                        setFormError('');
                      }}
                      className={cn('w-full rounded-lg border bg-white px-2.5 py-1.5 text-left transition-colors hover:border-zinc-400', email === a.email ? 'border-ink-950' : 'border-zinc-200')}
                    >
                      <span className="block text-xs font-medium text-zinc-900">{a.role}</span>
                      <span className="block truncate text-2xs text-zinc-500">{a.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} initialEmail={email} />
    </div>
  );
}
