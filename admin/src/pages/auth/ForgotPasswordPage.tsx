import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { authService } from '@/services/authService';
import { ApiError } from '@/services/api';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/forms/Inputs';
import { isEmail } from '@/utils/validation';
import { useDocumentTitle } from '@/hooks/misc';
import { AuthAlert, AuthShell } from './AuthShell';

export default function ForgotPasswordPage() {
  useDocumentTitle('Forgot password');
  const initial = (useLocation().state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(initial);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!isEmail(email)) return setError('Enter a valid email address.');
    setError('');
    setState('sending');
    try {
      await authService.requestPasswordReset(email);
      setState('sent');
    } catch (err) {
      setState('idle');
      setFormError(
        err instanceof ApiError && err.code === 'RATE_LIMITED'
          ? 'Too many reset requests. Please wait a few minutes and try again.'
          : err instanceof Error
            ? err.message
            : 'Could not send the reset link. Please try again.',
      );
    }
  };

  return (
    <AuthShell>
      <Link to="/login" className="mb-6 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-zinc-600 hover:text-zinc-950">
        <ArrowLeft size={14} aria-hidden /> Back to sign in
      </Link>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Reset your password</h2>
      <p className="mt-1.5 text-sm text-zinc-500">Enter your staff email and we’ll send you a secure link to choose a new password.</p>

      {state === 'sent' ? (
        <div className="mt-8 rounded-xl border border-zinc-200 p-6 text-center">
          <CheckCircle2 className="mx-auto text-emerald-500" size={36} aria-hidden />
          <p className="mt-3 text-sm font-medium text-zinc-900">Check your inbox</p>
          <p className="mt-1 text-[0.8125rem] text-zinc-500">If an admin account exists for {email}, a reset link is on its way. For security the link expires soon — use it right away.</p>
          <Link to="/login" state={{ email }} className="mt-5 inline-flex h-9 items-center rounded-lg border border-zinc-300 px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          {formError && (
            <AuthAlert tone="error">
              <AlertCircle size={16} className="mt-px shrink-0" aria-hidden />
              {formError}
            </AuthAlert>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Input
              label="Work email"
              type="email"
              icon={Mail}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              error={error}
              autoComplete="email"
              autoFocus
              required
            />
            <Button type="submit" variant="primary" size="lg" fullWidth loading={state === 'sending'}>
              Send reset link
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
