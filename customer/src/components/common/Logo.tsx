import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SITE } from '@/constants/site';
import { cn } from '@/utils/cn';

interface LogoProps {
  tone?: 'dark' | 'light';
  className?: string;
  /** Visual height of the mark; the image keeps its aspect ratio. */
  size?: 'sm' | 'md' | 'lg';
  asLink?: boolean;
  onClick?: () => void;
}

const HEIGHTS = { sm: 'h-7', md: 'h-8 lg:h-9', lg: 'h-12' } as const;
const EMBLEM = { sm: 'h-9 w-9', md: 'h-10 w-10 lg:h-11 lg:w-11', lg: 'h-20 w-20' } as const;
const TEXT = { sm: 'text-[1.6rem]', md: 'text-[1.85rem] lg:text-[2.1rem]', lg: 'text-5xl' } as const;

/**
 * Renders /public/logo.png.
 * - Horizontal / square artwork renders at a fixed height.
 * - Portrait artwork (e.g. a logo photographed on a background) is shown as a
 *   centred square emblem so it stays legible at header sizes.
 * - If the file is missing, a typographic wordmark keeps the layout intact.
 */
export function Logo({ tone = 'dark', className, size = 'md', asLink = true, onClick }: LogoProps) {
  const [failed, setFailed] = useState(false);
  const [portrait, setPortrait] = useState(false);

  const mark = failed ? (
    <span className={cn('font-display font-extrabold italic leading-none tracking-[-0.03em]', TEXT[size], tone === 'light' ? 'text-white' : 'text-ink')}>
      SPORT<span className="text-accent">X</span>
    </span>
  ) : (
    <img
      src={SITE.logo}
      alt={SITE.name}
      className={cn(portrait ? cn(EMBLEM[size], 'object-cover object-center') : cn(HEIGHTS[size], 'w-auto object-contain'))}
      onLoad={(e) => setPortrait(e.currentTarget.naturalHeight > e.currentTarget.naturalWidth * 1.15)}
      onError={() => setFailed(true)}
    />
  );

  if (!asLink) return <span className={cn('inline-flex items-center', className)}>{mark}</span>;

  return (
    <Link to="/" onClick={onClick} className={cn('inline-flex items-center', className)} aria-label={`${SITE.name} home`}>
      {mark}
    </Link>
  );
}
