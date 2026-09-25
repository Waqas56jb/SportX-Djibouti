import { Check } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/utils/cn';

/** Step ids; labels come from `checkout.steps.<id>`. */
export const CHECKOUT_STEPS = ['information', 'shipping', 'payment', 'confirmation'] as const;

/** Progress indicator. `current` is 0-based; steps before it are complete. */
export function CheckoutSteps({ current, onStepClick }: { current: number; onStepClick?: (index: number) => void }) {
  const { t } = useT();
  return (
    <nav aria-label={t('checkout.steps.progress')}>
      <ol className="flex items-center">
        {CHECKOUT_STEPS.map((step, i) => {
          const label = t(`checkout.steps.${step}`);
          const done = i < current;
          const active = i === current;
          const clickable = done && onStepClick && i < 3;
          const content = (
            <>
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                  done ? 'border-ink bg-ink text-white' : active ? 'border-ink text-ink' : 'border-paper-300 text-ink-500',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span className={cn('hidden text-xs font-semibold uppercase tracking-[0.12em] sm:inline', active || done ? 'text-ink' : 'text-ink-500')}>{label}</span>
            </>
          );
          return (
            <li key={step} className={cn('flex items-center', i < CHECKOUT_STEPS.length - 1 && 'flex-1')} aria-current={active ? 'step' : undefined}>
              {clickable ? (
                <button type="button" onClick={() => onStepClick(i)} className="flex items-center gap-2.5 hover:opacity-80" aria-label={t('checkout.steps.edit', { step: label })}>
                  {content}
                </button>
              ) : (
                <span className="flex items-center gap-2.5">
                  {content}
                  <span className="sr-only">{done ? t('checkout.steps.completed') : active ? t('checkout.steps.current') : ''}</span>
                </span>
              )}
              {i < CHECKOUT_STEPS.length - 1 && <span className={cn('mx-3 h-px flex-1 sm:mx-4', done ? 'bg-ink' : 'bg-paper-300')} aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
