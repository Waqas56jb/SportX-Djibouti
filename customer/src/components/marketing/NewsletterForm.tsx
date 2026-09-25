import { ArrowRight, Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Spinner } from '@/components/common';
import { errorMessage, marketingService } from '@/services';
import { cn } from '@/utils/cn';
import { email as validateEmail } from '@/utils/validation';

export function NewsletterForm({ tone = 'light', compact = false }: { tone?: 'light' | 'dark'; compact?: boolean }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const dark = tone === 'dark';
  const id = compact ? 'newsletter-footer' : 'newsletter-main';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateEmail(value);
    if (err) {
      setStatus('error');
      setMessage(err);
      return;
    }
    setStatus('loading');
    setMessage(null);
    try {
      const res = await marketingService.subscribeNewsletter(value);
      setStatus('success');
      setMessage(res.alreadySubscribed ? 'You’re already part of the movement.' : 'Welcome to the movement. Watch your inbox.');
      setValue('');
    } catch (error) {
      setStatus('error');
      setMessage(errorMessage(error));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="w-full">
      <div className={cn('flex border-b-2 transition-colors', dark ? 'border-white/30 focus-within:border-white' : 'border-ink/20 focus-within:border-ink', status === 'error' && 'border-danger')}>
        <label htmlFor={id} className="sr-only">
          Email address
        </label>
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (status === 'error') setStatus('idle');
          }}
          placeholder="Your email address"
          aria-invalid={status === 'error' || undefined}
          aria-describedby={`${id}-msg`}
          className={cn(
            'min-w-0 flex-1 bg-transparent py-3 focus:outline-none',
            compact ? 'text-sm' : 'text-base sm:text-lg',
            dark ? 'text-white placeholder:text-white/40' : 'text-ink placeholder:text-ink/40',
          )}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className={cn('flex min-h-[44px] items-center gap-2 pl-4 text-xs font-semibold uppercase tracking-[0.14em] transition-colors', dark ? 'text-white hover:text-accent' : 'text-ink hover:text-accent-dark')}
        >
          {status === 'loading' ? <Spinner className="h-4 w-4" /> : status === 'success' ? <Check className="h-4 w-4" /> : null}
          <span>{compact ? 'Join' : 'Subscribe'}</span>
          {status !== 'loading' && status !== 'success' && <ArrowRight className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      <p id={`${id}-msg`} role={status === 'error' ? 'alert' : 'status'} className={cn('mt-2 min-h-[1.25rem] text-xs', status === 'error' ? (dark ? 'text-[#FF9C8A]' : 'text-danger') : dark ? 'text-white/60' : 'text-ink-500')}>
        {message ?? (compact ? '' : 'New releases, athlete stories and member-only offers. Unsubscribe anytime.')}
      </p>
    </form>
  );
}
