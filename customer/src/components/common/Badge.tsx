import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type BadgeTone = 'dark' | 'light' | 'accent' | 'sale' | 'success' | 'warning' | 'danger' | 'neutral' | 'outline';

const TONES: Record<BadgeTone, string> = {
  dark: 'bg-ink text-white',
  light: 'bg-white text-ink',
  accent: 'bg-accent text-ink',
  sale: 'bg-accent-dark text-white',
  success: 'bg-success-50 text-success',
  warning: 'bg-warning-50 text-warning',
  danger: 'bg-danger-50 text-danger',
  neutral: 'bg-paper-200 text-ink-700',
  outline: 'border border-ink/20 text-ink-700',
};

export function Badge({ tone = 'dark', children, className, dot }: { tone?: BadgeTone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.12em]',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
