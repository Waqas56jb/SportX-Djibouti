import { Link } from 'react-router-dom';
import { SITE } from '@/constants/site';
import { t } from '@/i18n';
import { cn } from '@/utils/cn';

interface LogoProps {
  /**
   * `mark`: wolf + WOLF wordmark (header, drawers, checkout) — legible at small sizes.
   * `full`: the complete lockup with the "100% SPORTSWEARS" strapline (footer, large placements).
   */
  variant?: 'mark' | 'full';
  /** Background the logo sits on. On light surfaces the gold artwork gets a dark badge to keep its contrast. */
  surface?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  asLink?: boolean;
  onClick?: () => void;
}

const MARK_HEIGHT = { sm: 'h-10', md: 'h-12 xl:h-[54px]', lg: 'h-16 sm:h-20' } as const;
const FULL_HEIGHT = { sm: 'h-16', md: 'h-20', lg: 'h-24 sm:h-28' } as const;

/** WOLF brand logo (gold artwork with transparent background, generated from /public/logo.png). */
export function Logo({ variant = 'mark', surface = 'dark', size = 'md', className, asLink = true, onClick }: LogoProps) {
  const img = (
    <img
      src={variant === 'full' ? SITE.logo : SITE.logoMark}
      alt={SITE.name}
      width={variant === 'full' ? 405 : 290}
      height={variant === 'full' ? 320 : 192}
      className={cn('w-auto select-none object-contain', variant === 'full' ? FULL_HEIGHT[size] : MARK_HEIGHT[size])}
      draggable={false}
    />
  );
  const mark = surface === 'dark' ? img : <span className="inline-flex items-center rounded-sm bg-ink px-2.5 py-1.5">{img}</span>;

  if (!asLink) return <span className={cn('inline-flex shrink-0 items-center', className)}>{mark}</span>;
  return (
    <Link to="/" onClick={onClick} className={cn('inline-flex shrink-0 items-center', className)} aria-label={t('common.a11y.home', { name: SITE.name })}>
      {mark}
    </Link>
  );
}
