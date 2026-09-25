import { useState } from 'react';
import type { CampaignType } from '@/types';
import { CAMPAIGN_TYPES } from '@/constants/catalog';
import { cn } from '@/utils/cn';

export const campaignTypeLabel = (t: CampaignType) => CAMPAIGN_TYPES.find((x) => x.value === t)?.label ?? t;

/** Deterministic variation so generated banners don't all look identical. */
function variant(name: string) {
  const h = [...name].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  return { angle: 14 + (h % 3) * 6, offset: 52 + (h % 4) * 6 };
}

/**
 * Campaign banner: the uploaded image when present, otherwise a generated typographic banner
 * (ink background, condensed display type, volt accent stripe). No stock imagery.
 */
export function CampaignBanner({ name, type, src, className, size = 'md' }: { name: string; type: CampaignType; src?: string; className?: string; size?: 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <div className={cn('relative overflow-hidden bg-zinc-100', className)}>
        <img src={src} alt={`${name} banner`} onError={() => setFailed(true)} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      </div>
    );
  }
  const v = variant(name || 'SPORTX');
  return (
    <div className={cn('relative isolate overflow-hidden bg-ink-950', className)} role="img" aria-label={`${name || 'Campaign'} generated banner`}>
      {/* grid texture */}
      <div className="absolute inset-0 -z-10 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} aria-hidden />
      {/* volt accent stripes */}
      <div className="absolute -inset-y-8 -z-10 w-10 bg-volt" style={{ left: `${v.offset}%`, transform: `skewX(-${v.angle}deg)` }} aria-hidden />
      <div className="absolute -inset-y-8 -z-10 w-2 bg-volt/60" style={{ left: `calc(${v.offset}% + 3.25rem)`, transform: `skewX(-${v.angle}deg)` }} aria-hidden />
      <div className="absolute inset-y-0 right-0 -z-10 w-1/2 bg-gradient-to-l from-ink-950/0 via-ink-950/0 to-ink-950" aria-hidden />
      <div className="flex h-full flex-col justify-between p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{campaignTypeLabel(type)}</span>
          <span className="font-display text-sm font-extrabold italic tracking-wide text-white/80">
            SPORT<span className="text-volt">X</span>
          </span>
        </div>
        <div className={cn('max-w-[80%] font-display font-extrabold uppercase italic leading-[0.9] tracking-tight text-white [text-wrap:balance]', size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-[1.75rem]', 'line-clamp-2')}>
          {name || 'Campaign name'}
        </div>
      </div>
    </div>
  );
}
