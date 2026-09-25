import type { ReactNode } from 'react';
import { Breadcrumbs, SmartImage, type Crumb } from '@/components/common';
import { cn } from '@/utils/cn';

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  image?: string;
  crumbs: Crumb[];
  meta?: ReactNode;
  size?: 'md' | 'lg';
}

/** Banner for collection, category and content pages. Falls back to a type-only header without an image. */
export function PageHero({ eyebrow, title, description, image, crumbs, meta, size = 'md' }: PageHeroProps) {
  if (!image) {
    return (
      <div className="container-site pb-8 pt-8 sm:pt-10">
        <Breadcrumbs items={crumbs} />
        {eyebrow && <p className="eyebrow mt-8">{eyebrow}</p>}
        <h1 className="heading-xl mt-3 break-words">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-ink-500">{description}</p>}
        {meta && <div className="mt-4">{meta}</div>}
      </div>
    );
  }
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white">
      <SmartImage src={image} alt="" priority maxWidth={1920} wrapperClassName="absolute inset-0 -z-10" className="opacity-60" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/90 via-ink/60 to-ink/10 rtl:bg-gradient-to-l" aria-hidden />
      <div className={cn('container-site flex flex-col justify-end pb-10 pt-8 sm:pb-14', size === 'lg' ? 'min-h-[420px] sm:min-h-[520px]' : 'min-h-[300px] sm:min-h-[380px]')}>
        <Breadcrumbs items={crumbs} tone="light" className="mb-auto" />
        {eyebrow && <p className="mt-10 text-xs font-semibold uppercase tracking-[0.3em] text-accent">{eyebrow}</p>}
        <h1 className="mt-3 break-words font-display text-[2.5rem] font-extrabold uppercase leading-[0.88] tracking-[-0.02em] text-white sm:text-display-lg lg:text-display-xl">{title}</h1>
        {description && <p className="mt-4 max-w-xl text-[15px] text-white/75 sm:text-base">{description}</p>}
        {meta && <div className="mt-5 text-sm text-white/60">{meta}</div>}
      </div>
    </section>
  );
}
