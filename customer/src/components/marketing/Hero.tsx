import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonLink, SmartImage } from '@/components/common';
import { productPath } from '@/constants/routes';
import { IMG } from '@/data/images';
import { useT } from '@/i18n';

/**
 * Homepage hero: full-bleed football photography, oversized condensed type
 * and a featured-product card anchoring the composition on desktop.
 */
export function Hero() {
  const { t } = useT();
  const arrow = <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />;
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white" aria-labelledby="hero-title">
      <SmartImage src={IMG.playerVoltKit} alt={t('home.hero.imageAlt')} priority maxWidth={1920} wrapperClassName="absolute inset-0 -z-10 bg-ink" className="object-[70%_30%] opacity-80 sm:object-[65%_35%]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/70 to-ink/10 rtl:bg-gradient-to-l" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/20 to-transparent" aria-hidden />

      <div className="container-site relative flex min-h-[calc(100svh-104px)] flex-col justify-end pb-10 pt-20 sm:min-h-[680px] sm:pb-14 lg:min-h-[760px] 2xl:min-h-[840px]">
        <div className="max-w-4xl">
          <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.3em] text-accent [animation-delay:80ms]">{t('home.hero.eyebrow')}</p>
          <h1 id="hero-title" className="display-hero mt-5 animate-fade-up text-white [animation-delay:160ms]">
            {t('home.hero.titleA')}
            <br />
            <span className="hero-outline text-transparent [-webkit-text-stroke:2px_#fff] sm:[-webkit-text-stroke:3px_#fff]">{t('home.hero.titleB')}</span>
          </h1>
          <p className="mt-6 max-w-lg animate-fade-up text-base text-white/75 [animation-delay:260ms] sm:text-lg">{t('home.hero.body')}</p>
          <div className="mt-9 grid animate-fade-up grid-cols-1 gap-3 [animation-delay:340ms] sm:flex">
            <ButtonLink to="/categories/football-boots" variant="light" size="lg" rightIcon={arrow}>
              {t('home.hero.ctaBoots')}
            </ButtonLink>
            <ButtonLink to="/categories/team-kits" variant="outline-light" size="lg" rightIcon={arrow}>
              {t('home.hero.ctaKits')}
            </ButtonLink>
          </div>
        </div>

        <div className="mt-12 flex items-end justify-between gap-6 border-t border-white/15 pt-6 sm:mt-14">
          <dl className="grid w-full grid-cols-3 gap-4 sm:w-auto sm:gap-12">
            {(
              [
                ['stat1', 'stat1Label'],
                ['stat2', 'stat2Label'],
                ['stat3', 'stat3Label'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="sr-only">{t(`home.hero.${v}`)}</dt>
                <dd className="font-display text-2xl font-bold leading-none xs:text-3xl sm:text-4xl">{t(`home.hero.${k}`)}</dd>
                <dd className="mt-1.5 text-[10px] uppercase leading-snug tracking-[0.14em] text-white/55 xs:text-[11px]">{t(`home.hero.${v}`)}</dd>
              </div>
            ))}
          </dl>

          <Link
            to={productPath('wolf-blaze-elite-fg')}
            className="group hidden w-[300px] shrink-0 items-center gap-4 bg-white/10 p-3 pe-5 backdrop-blur-md transition-colors hover:bg-white/15 lg:flex"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-white">
              <SmartImage src={IMG.bootsOrangeCorner} alt="" sizes="80px" maxWidth={320} wrapperClassName="absolute inset-0" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">{t('home.hero.featured')}</p>
              <p className="mt-1 truncate text-sm font-semibold">{t('home.hero.featuredName')}</p>
              <p className="mt-0.5 text-xs text-white/60">{t('home.hero.featuredSub')}</p>
            </div>
            <ArrowUpRight className="h-5 w-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
