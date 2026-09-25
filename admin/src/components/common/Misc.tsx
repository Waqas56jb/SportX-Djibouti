import { useState, type ReactNode } from 'react';
import { Star, ImageOff } from 'lucide-react';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';
import { BRAND, LOGO_SRC } from '@/constants/brand';

const AVATAR_TONES = ['bg-zinc-900 text-white', 'bg-zinc-200 text-zinc-800', 'bg-volt text-ink-950', 'bg-zinc-700 text-white', 'bg-stone-200 text-stone-800'];

export function Avatar({ name, src, size = 32, className }: { name: string; src?: string; size?: number; className?: string }) {
  const tone = AVATAR_TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span
      className={cn('inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold', !src && tone, className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}

/** Product image with graceful fallback — never shows a broken image icon. */
export function ProductThumb({ src, alt, size = 40, className }: { src?: string; alt: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200/80 bg-zinc-100', className)} style={{ width: size, height: size }}>
      {src && !failed ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <ImageOff size={Math.round(size * 0.4)} className="text-zinc-300" aria-label={alt} />
      )}
    </span>
  );
}

export function Rating({ value, size = 13, showValue }: { value: number; size?: number; showValue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value} out of 5 stars`}>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={size} aria-hidden className={i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-zinc-200 text-zinc-200'} />
        ))}
      </span>
      {showValue && <span className="text-xs font-medium text-zinc-600 tabular">{value.toFixed(1)}</span>}
    </span>
  );
}

/** SPORTX wordmark. Uses the official logo file when configured, otherwise typographic mark. */
export function Wordmark({ dark = true, compact, showTagline = true, className }: { dark?: boolean; compact?: boolean; showTagline?: boolean; className?: string }) {
  if (LOGO_SRC) return <img src={LOGO_SRC} alt={BRAND.name} className={cn('h-8 w-auto', className)} />;
  if (compact)
    return (
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg font-display text-xl font-extrabold', dark ? 'bg-volt text-ink-950' : 'bg-ink-950 text-volt', className)} aria-label={BRAND.name}>
        X
      </span>
    );
  return (
    <span className={cn('flex flex-col leading-none', className)} aria-label={`${BRAND.name} — ${BRAND.tagline}`}>
      <span className={cn('font-display text-[1.65rem] font-extrabold italic tracking-[0.02em]', dark ? 'text-white' : 'text-ink-950')}>
        SPORT<span className={dark ? 'text-volt' : 'text-volt-700'}>X</span>
      </span>
      {showTagline && <span className={cn('mt-1 text-[0.5625rem] font-semibold tracking-[0.28em]', dark ? 'text-zinc-500' : 'text-zinc-400')}>{BRAND.tagline}</span>}
    </span>
  );
}

export function Kbd({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-sans text-[10px] font-medium', dark ? 'border-white/15 bg-white/5 text-zinc-400' : 'border-zinc-200 bg-zinc-50 text-zinc-500')}>
      {children}
    </kbd>
  );
}

/** Makes it explicit that numbers are demo data, not live production analytics. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      title="Frontend demo — figures are generated mock data until the backend is connected."
      className={cn('inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500', className)}
    >
      Demo data
    </span>
  );
}

export function ColorDot({ hex, size = 12, className }: { hex: string; size?: number; className?: string }) {
  return <span className={cn('inline-block shrink-0 rounded-full ring-1 ring-inset ring-black/10', className)} style={{ width: size, height: size, background: hex }} aria-hidden />;
}

/** Signed change indicator, e.g. +12.4%. */
export function Delta({ value, inverse, className, suffix = '%' }: { value: number; inverse?: boolean; className?: string; suffix?: string }) {
  const good = inverse ? value < 0 : value > 0;
  const neutral = Math.abs(value) < 0.05;
  return (
    <span className={cn('inline-flex items-center rounded px-1 py-px text-xs font-semibold tabular', neutral ? 'text-zinc-500' : good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700', className)}>
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}
