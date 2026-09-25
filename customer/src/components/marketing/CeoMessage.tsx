import { ArrowRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Reveal } from '@/components/common';
import { SITE } from '@/constants/site';
import { useT } from '@/i18n';
import { cn } from '@/utils/cn';

/**
 * "A word from our CEO" — portrait with a gold offset frame, pull quote and signature block.
 * Used on the homepage (with a link to the story) and on the About page (anchor `#ceo`).
 */
export function CeoMessage({ showLink = true, className }: { showLink?: boolean; className?: string }) {
  const { t } = useT();
  const name = SITE.ceo.name.trim();

  return (
    <section id="ceo" className={cn('relative overflow-hidden bg-paper-50 py-16 sm:py-24 lg:py-28', className)} aria-labelledby="ceo-title">
      {/* Soft gold wash behind the portrait */}
      <div className="pointer-events-none absolute -start-40 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" aria-hidden />

      <div className="container-site relative grid items-center gap-12 sm:gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <Reveal className="mx-auto w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[420px]">
          <figure className="relative pb-6 pe-6">
            {/* Offset frame */}
            <div className="absolute inset-0 start-6 top-6 border-[3px] border-gold bg-gold/10" aria-hidden />
            <div className="relative aspect-[2/3] overflow-hidden bg-ink shadow-lift">
              <picture>
                <source srcSet={SITE.ceo.portraitWebp} type="image/webp" />
                <img
                  src={SITE.ceo.portrait}
                  alt={t('home.ceo.imageAlt')}
                  width={680}
                  height={1020}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-[50%_20%]"
                />
              </picture>
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/80 to-transparent" aria-hidden />
              <figcaption className="absolute inset-x-4 bottom-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-light" aria-hidden />
                <span>{t('home.ceo.caption')}</span>
              </figcaption>
            </div>
            {/* Brand seal */}
            <div className="absolute -bottom-1 -end-1 flex h-[88px] w-[88px] items-center justify-center rounded-full border-4 border-paper-50 bg-ink shadow-lift sm:h-[104px] sm:w-[104px]">
              <img src={SITE.logoMark} alt="" className="h-9 w-auto sm:h-11" aria-hidden />
            </div>
          </figure>
        </Reveal>

        <Reveal delay={120}>
          <p className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-gold-dark">
            <span className="h-px w-10 bg-gold" aria-hidden />
            {t('home.ceo.eyebrow')}
          </p>
          <h2 id="ceo-title" className="heading-xl mt-4">
            {t('home.ceo.title')}
          </h2>

          <blockquote className="mt-8 border-s-[3px] border-gold ps-5 sm:mt-10 sm:ps-7">
            <span className="block h-9 select-none font-serif text-[72px] leading-[0.9] text-gold sm:h-11 sm:text-[88px]" aria-hidden>
              “
            </span>
            <p className="text-xl font-medium leading-relaxed text-ink sm:text-2xl sm:leading-relaxed">{t('home.ceo.quote')}</p>
          </blockquote>

          <div className="mt-8 max-w-2xl space-y-4 text-[15px] leading-relaxed text-ink-600">
            <p>{t('home.ceo.body1')}</p>
            <p>{t('home.ceo.body2')}</p>
          </div>

          <div className="mt-10 flex flex-col gap-6 border-t border-ink/10 pt-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {name && <p className="font-display text-3xl font-bold uppercase leading-none tracking-tight">{name}</p>}
              <p className={cn('text-sm font-semibold text-ink', name && 'mt-2')}>{t('home.ceo.role')}</p>
              <p className="mt-0.5 text-sm text-ink-500">{t('home.ceo.company')}</p>
            </div>
            {showLink && (
              <Link to="/about#ceo" className="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink">
                <span className="link-underline">{t('home.ceo.cta')}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
