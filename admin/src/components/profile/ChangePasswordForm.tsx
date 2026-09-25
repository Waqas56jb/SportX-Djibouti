import { useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, KeyRound, Lock, X } from 'lucide-react';
import { Button } from '@/components/common';
import { FormSection, Input } from '@/components/forms';
import { authService } from '@/services/authService';
import { ApiError } from '@/services/http';
import { appConfig } from '@/constants/config';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

interface FormState {
  current: string;
  next: string;
  confirm: string;
}
type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = { current: '', next: '', confirm: '' };
const LEVELS = [
  { label: 'Too weak', bar: 'bg-red-500', text: 'text-red-600' },
  { label: 'Weak', bar: 'bg-orange-500', text: 'text-orange-600' },
  { label: 'Fair', bar: 'bg-amber-500', text: 'text-amber-700' },
  { label: 'Strong', bar: 'bg-emerald-500', text: 'text-emerald-700' },
  { label: 'Excellent', bar: 'bg-ink-950', text: 'text-zinc-950' },
];

export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[a-z]/i.test(pw)) s++;
  if (/[^a-z0-9]/i.test(pw)) s++;
  if (pw.length < 10) s = Math.min(s, 1);
  return Math.min(4, s);
}

function StrengthMeter({ value }: { value: string }) {
  const score = passwordScore(value);
  const lvl = LEVELS[score];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', value && i <= Math.max(1, score) ? lvl.bar : 'bg-zinc-200')} />
        ))}
      </div>
      {value && (
        <p className="mt-1.5 text-xs">
          <span className="text-zinc-500">Strength: </span>
          <span className={cn('font-semibold', lvl.text)}>{lvl.label}</span>
        </p>
      )}
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: string }) {
  return (
    <li className={cn('flex items-center gap-2 text-xs', ok ? 'text-emerald-700' : 'text-zinc-500')}>
      <span className={cn('flex h-4 w-4 items-center justify-center rounded-full', ok ? 'bg-emerald-100' : 'bg-zinc-100')}>{ok ? <Check size={10} strokeWidth={3} aria-hidden /> : <X size={10} strokeWidth={3} aria-hidden />}</span>
      {children}
      <span className="sr-only">{ok ? '— met' : '— not met'}</span>
    </li>
  );
}

export function ChangePasswordForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const rules = {
    length: form.next.length >= 10,
    letter: /[a-z]/i.test(form.next),
    number: /\d/.test(form.next),
    differs: Boolean(form.next) && form.next !== form.current,
  };
  const rulesOk = Object.values(rules).every(Boolean);

  const set = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    if (!form.current) errs.current = 'Enter your current password.';
    if (!form.next) errs.next = 'Enter a new password.';
    else if (!rulesOk) errs.next = 'The new password doesn’t meet all the rules below.';
    if (!form.confirm) errs.confirm = 'Confirm your new password.';
    else if (form.confirm !== form.next) errs.confirm = 'Passwords don’t match.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await authService.changePassword(form.current, form.next);
      setForm(EMPTY);
      setShow(false);
      toast.success('Password updated.', { description: 'Use your new password next time you sign in.' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_password') setErrors({ current: 'Current password is incorrect.' });
      else toast.error('Couldn’t change your password.', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const type = show ? 'text' : 'password';
  const toggle = (
    <button type="button" onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-950" aria-pressed={show}>
      {show ? <EyeOff size={12} aria-hidden /> : <Eye size={12} aria-hidden />} {show ? 'Hide' : 'Show'} passwords
    </button>
  );

  return (
    <FormSection id="password" title="Change password" description="At least 10 characters with a letter and a number. You stay signed in on this device.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <Input
          label="Current password"
          required
          type={type}
          icon={Lock}
          value={form.current}
          onChange={(e) => set('current', e.target.value)}
          error={errors.current}
          autoComplete="current-password"
          aside={toggle}
          help={appConfig.useMocks ? 'Demo mode: the current password is sportx2026.' : undefined}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input label="New password" required type={type} icon={KeyRound} value={form.next} onChange={(e) => set('next', e.target.value)} error={errors.next} autoComplete="new-password" />
            <StrengthMeter value={form.next} />
          </div>
          <Input label="Confirm new password" required type={type} icon={KeyRound} value={form.confirm} onChange={(e) => set('confirm', e.target.value)} error={errors.confirm} autoComplete="new-password" />
        </div>
        <ul className="grid gap-1.5 rounded-lg bg-zinc-50 px-3.5 py-3 sm:grid-cols-2" aria-label="Password rules">
          <Rule ok={rules.length}>At least 10 characters</Rule>
          <Rule ok={rules.letter}>Contains a letter</Rule>
          <Rule ok={rules.number}>Contains a number</Rule>
          <Rule ok={rules.differs}>Different from current password</Rule>
        </ul>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={saving}>
            Update password
          </Button>
        </div>
      </form>
    </FormSection>
  );
}
