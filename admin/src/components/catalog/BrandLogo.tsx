import { useState } from 'react';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';

/** Brand logo tile; falls back to a monogram when no logo is set or it fails to load. */
export function BrandLogo({ name, src, size = 56, className }: { name: string; src?: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const mono = name.trim().split(/\s+/).length > 1 ? initials(name) : name.trim().slice(0, 2).toUpperCase();
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border', src && !failed ? 'border-zinc-200 bg-white' : 'border-ink-950 bg-ink-950', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src && !failed ? (
        <img src={src} alt="" className="h-full w-full object-contain p-2" onError={() => setFailed(true)} />
      ) : (
        <span className="font-display font-extrabold italic tracking-wide text-white" style={{ fontSize: Math.round(size * 0.4) }}>
          {mono || '?'}
          <span className="text-volt">.</span>
        </span>
      )}
    </span>
  );
}
