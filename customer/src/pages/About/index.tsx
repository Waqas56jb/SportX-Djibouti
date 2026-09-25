import { ArrowRight, Phone } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ButtonLink, Reveal, SmartImage } from '@/components/common';
import { CeoMessage } from '@/components/marketing/CeoMessage';
import { PageHero } from '@/components/marketing/PageHero';
import { SITE } from '@/constants/site';
import { IMG } from '@/data/images';
import { usePageMeta } from '@/hooks/usePageMeta';
import { tDynamic, useT } from '@/i18n';

const PILLARS = [1, 2, 3, 4, 5, 6] as const;

/** Scrolls to `location.hash` (e.g. `/about#ceo` from the homepage) once the page has rendered. */
function useHashScroll() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (++tries < 20) timer = setTimeout(attempt, 50);
    };
    // Let the route's scroll restoration run first, then jump to the anchor.
    timer = setTimeout(attempt, 60);
    return () => clearTimeout(timer);
  }, [hash]);
}

export default function AboutPage() {
  const { t } = useT();
  useHashScroll();
  usePageMeta({ title: t('pages.about.metaTitle'), description: t('pages.about.metaDescription') });

  return (
    <>
      <PageHero
        eyebrow={t('pages.about.hero.eyebrow')}
        title={t('pages.about.hero.title')}
        description={t('pages.about.hero.description')}
        image={IMG.teamHuddleYellow}
        crumbs={[{ label: t('pages.about.crumb') }]}
        size="lg"
      />

      <section className="container-site grid grid-cols-1 gap-10 py-16 sm:gap-12 sm:py-28 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
        <Reveal>
          <p className="eyebrow">{t('pages.about.story.eyebrow')}</p>
          <h2 className="heading-xl mt-4">
            {t('pages.about.story.line1')}
            <br />
            {t('pages.about.story.line2')}
            <br />
            <span className="text-accent-dark">{t('pages.about.story.line3')}</span>
          </h2>
        </Reveal>
        <Reveal delay={100} className="space-y-6 text-base leading-relaxed text-ink-600 sm:text-lg">
          <p>{t('pages.about.story.p1')}</p>
          <p>{t('pages.about.story.p2')}</p>
          <p className="font-semibold text-ink">{t('pages.about.story.p3')}</p>
        </Reveal>
      </section>

      <CeoMessage showLink={false} className="scroll-mt-24" />

      <section className="grid lg:grid-cols-2" aria-label={t('pages.about.gallery.label')}>
        <div className="relative min-h-[300px] sm:min-h-[520px]">
          <SmartImage src={IMG.headerDuel} alt={t('pages.about.gallery.alt1')} sizes="(min-width: 1024px) 50vw, 100vw" wrapperClassName="absolute inset-0" />
        </div>
        <div className="grid grid-cols-2">
          <div className="relative min-h-[200px] sm:min-h-[260px]">
            <SmartImage src={IMG.goalkeeperSave} alt={t('pages.about.gallery.alt2')} sizes="(min-width: 1024px) 25vw, 50vw" wrapperClassName="absolute inset-0" />
          </div>
          <div className="relative min-h-[200px] sm:min-h-[260px]">
            <SmartImage src={IMG.jugglingSunset} alt={t('pages.about.gallery.alt3')} sizes="(min-width: 1024px) 25vw, 50vw" wrapperClassName="absolute inset-0" />
          </div>
          <div className="col-span-2 flex flex-col justify-center bg-ink p-6 text-white sm:p-12">
            <p className="font-display text-3xl font-extrabold uppercase leading-[0.9] sm:text-5xl">{t('pages.about.gallery.title')}</p>
            <p className="mt-4 max-w-md text-white/70">{t('pages.about.gallery.body')}</p>
          </div>
        </div>
      </section>

      <section className="container-site py-16 sm:py-28" aria-labelledby="pillars-title">
        <p className="eyebrow">{t('pages.about.pillars.eyebrow')}</p>
        <h2 id="pillars-title" className="heading-xl mt-4 max-w-3xl">
          {t('pages.about.pillars.title')}
        </h2>
        <ul className="mt-10 grid gap-px bg-paper-200 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((n, i) => (
            <li key={n} className="bg-white">
              <Reveal delay={(i % 3) * 80} className="h-full p-6 sm:p-8">
                <span className="font-display text-sm font-semibold text-accent-dark">0{n}</span>
                <h3 className="mt-6 font-display text-3xl font-bold uppercase">{tDynamic(`pages.about.pillars.p${n}Title`, '')}</h3>
                <p className="mt-3 leading-relaxed text-ink-500">{tDynamic(`pages.about.pillars.p${n}Text`, '')}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-paper-100">
        <div className="container-site grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="eyebrow">{t('pages.about.teams.eyebrow')}</p>
            <h2 className="heading-lg mt-4">{t('pages.about.teams.title')}</h2>
            <p className="mt-4 max-w-lg text-ink-600">{t('pages.about.teams.body')}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <ButtonLink to="/contact" variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
              {t('pages.about.teams.cta')}
            </ButtonLink>
            <a href={SITE.contact.phoneHref} className="btn btn-outline btn-lg" aria-label={t('pages.about.teams.call', { phone: SITE.contact.phone })}>
              <Phone className="h-4 w-4" aria-hidden />
              <span className="ltr-text">{SITE.contact.phone}</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
