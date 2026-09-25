import type { ReactNode } from 'react';
import type { Tone } from '@/types';
import type { StatusMeta } from '@/constants/status';
import { cn } from '@/utils/cn';

const TONES: Record<Tone, { bg: string; dot: string }> = {
  neutral: { bg: 'bg-zinc-100 text-zinc-700 ring-zinc-200', dot: 'bg-zinc-500' },
  muted: { bg: 'bg-zinc-50 text-zinc-500 ring-zinc-200', dot: 'bg-zinc-400' },
  success: { bg: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70', dot: 'bg-emerald-500' },
  warning: { bg: 'bg-amber-50 text-amber-800 ring-amber-200/80', dot: 'bg-amber-500' },
  danger: { bg: 'bg-red-50 text-red-700 ring-red-200/70', dot: 'bg-red-500' },
  info: { bg: 'bg-sky-50 text-sky-700 ring-sky-200/70', dot: 'bg-sky-500' },
  brand: { bg: 'bg-ink-950 text-white ring-ink-950', dot: 'bg-volt' },
};

export interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', dot, size = 'sm', className, children }: BadgeProps) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-md font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-1 text-xs',
        t.bg,
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', t.dot)} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Renders a badge from a status meta map, e.g. <StatusBadge map={ORDER_STATUS} value={order.status} />. */
export function StatusBadge<K extends string>({ map, value, dot = true, size, prefix }: { map: Record<K, StatusMeta>; value: K; dot?: boolean; size?: 'sm' | 'md'; /** Context label, e.g. "Payment" → "Payment · Pending". */ prefix?: string }) {
  const meta = map[value];
  if (!meta) return <Badge>{String(value)}</Badge>;
  return (
    <Badge tone={meta.tone} dot={dot} size={size}>
      {prefix ? <><span className="opacity-60">{prefix} ·</span> {meta.label}</> : meta.label}
    </Badge>
  );
}

export function CountBadge({ count, tone = 'neutral', className }: { count: number; tone?: 'neutral' | 'danger' | 'volt' | 'dark'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular',
        tone === 'neutral' && 'bg-zinc-100 text-zinc-600',
        tone === 'danger' && 'bg-red-600 text-white',
        tone === 'volt' && 'bg-volt text-ink-950',
        tone === 'dark' && 'bg-white/10 text-zinc-300',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
