import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { loginErrorMessage } from '@/services/authService';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/forms/Inputs';
import { Checkbox } from '@/components/forms/Choice';
import { isEmail } from '@/utils/validation';
import { useDocumentTitle } from '@/hooks/misc';
import { AuthAlert, AuthShell } from './AuthShell';

export default function LoginPage() {
  useDocumentTitle('Sign in');
  const login = useAuthStore((s) => s.login);
  const notice = useAuthStore((s) => s.notice);
  const clearNotice = useAuthStore((s) => s.clearNotice);
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as { from?: string; email?: string; message?: string } | null;
  const from = locState?.from ?? '/dashboard';
  const [email, setEmail] = useState(locState?.email ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle');
  const info = notice ?? locState?.message ?? '';

  // The expiry notice is shown once, then cleared from the store.
  useEffect(() => () => clearNotice(), [clearNotice]);

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!isEmail(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
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
      setFormError(loginErrorMessage(err));
    }
  };

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Sign in to SPORTX Admin</h2>
      <p className="mt-1.5 text-sm text-zinc-500">Use your staff account to access the store back office.</p>

      {info && !formError && state === 'idle' && (
        <AuthAlert tone="info">
          <Clock3 size={16} className="mt-px shrink-0" aria-hidden />
          {info}
        </AuthAlert>
      )}
      {formError && (
        <AuthAlert tone="error">
          <AlertCircle size={16} className="mt-px shrink-0" aria-hidden />
          {formError}
        </AuthAlert>
      )}
      {state === 'success' && (
        <AuthAlert tone="success">
          <CheckCircle2 size={16} className="mt-px shrink-0" aria-hidden /> Signed in. Loading your dashboard…
        </AuthAlert>
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
          <Link to="/forgot-password" state={{ email }} className="text-[0.8125rem] font-medium text-zinc-700 underline-offset-4 hover:text-zinc-950 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" fullWidth loading={state === 'loading'} disabled={state === 'success'} iconRight={state === 'idle' ? ArrowRight : undefined}>
          {state === 'loading' ? 'Signing in…' : state === 'success' ? 'Signed in' : 'Sign In'}
        </Button>
      </form>
    </AuthShell>
  );
}
