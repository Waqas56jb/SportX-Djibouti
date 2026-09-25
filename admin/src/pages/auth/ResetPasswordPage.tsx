import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { authService } from '@/services/authService';
import { ApiError } from '@/services/api';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/forms/Inputs';
import { useDocumentTitle } from '@/hooks/misc';
import { authLinkToken } from '@/utils/authLink';
import { AuthAlert, AuthShell } from './AuthShell';

/** Mirrors the API rule: 8–128 characters with at least one letter and one number. */
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

export default function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = authLinkToken(params);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState('');
  const [expired, setExpired] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setExpired(false);
    const next: typeof errors = {};
    if (!PASSWORD_RULE.test(password)) next.password = 'Use 8–128 characters with at least one letter and one number.';
    if (confirmPw !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await authService.resetPassword(token, password);
      navigate('/login', { replace: true, state: { message: 'Password updated. Sign in with your new password.' } });
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') setFormError('Too many attempts. Please wait a few minutes and try again.');
      else if (err instanceof ApiError && (err.code === 'UNAUTHORIZED' || (err.code === 'VALIDATION_ERROR' && !JSON.stringify(err.details ?? '').includes('password')))) {
        setExpired(true);
        setFormError('This reset link is invalid or has expired.');
      } else setFormError(err instanceof Error ? err.message : 'Could not update your password.');
    }
  };

  return (
    <AuthShell>
      <Link to="/login" className="mb-6 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-zinc-600 hover:text-zinc-950">
        <ArrowLeft size={14} aria-hidden /> Back to sign in
      </Link>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Choose a new password</h2>
      <p className="mt-1.5 text-sm text-zinc-500">Pick a strong password you don’t use anywhere else.</p>

      {!token ? (
        <AuthAlert tone="error">
          <AlertCircle size={16} className="mt-px shrink-0" aria-hidden />
          <span>
            This reset link is incomplete.{' '}
            <Link to="/forgot-password" className="font-semibold underline underline-offset-2">
              Request a new link
            </Link>
            .
          </span>
        </AuthAlert>
      ) : (
        <>
          {formError && (
            <AuthAlert tone="error">
              <AlertCircle size={16} className="mt-px shrink-0" aria-hidden />
              <span>
                {formError}{' '}
                {expired && (
                  <Link to="/forgot-password" className="font-semibold underline underline-offset-2">
                    Send a new link
                  </Link>
                )}
              </span>
            </AuthAlert>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div className="relative">
              <Input
                label="New password"
                type={show ? 'text' : 'password'}
                icon={Lock}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                help="At least 8 characters, including a letter and a number."
                required
                inputClassName="pr-10"
                autoFocus
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-[30px] rounded-md p-1.5 text-zinc-400 hover:text-zinc-700">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Input label="Confirm new password" type={show ? 'text' : 'password'} icon={Lock} autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} error={errors.confirm} required />
            <Button type="submit" variant="primary" size="lg" fullWidth loading={saving}>
              Update password
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
