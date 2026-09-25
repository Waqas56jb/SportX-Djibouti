import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonLink, Price, Reveal, SectionHeading, SmartImage } from '@/components/common';
import { ProductCarousel } from '@/components/product';
import { productPath } from '@/constants/routes';
import { IMG } from '@/data/images';
import { useFeaturedProducts } from '@/hooks/useProducts';
import { useT } from '@/i18n';

const Arrow = () => <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />;

/** Full-bleed campaign: MATCH DAY STARTS HERE. */
export function CampaignBanner() {
  const { t } = useT();
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white" aria-labelledby="campaign-title">
      <SmartImage src={IMG.stadiumFloodlit} alt={t('home.campaign.imageAlt')} maxWidth={1920} wrapperClassName="absolute inset-0 -z-10" className="opacity-70" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/40 to-ink/90" aria-hidden />
      <div className="container-site flex min-h-[520px] flex-col items-center justify-center py-20 text-center sm:min-h-[640px] lg:min-h-[720px]">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{t('home.campaign.eyebrow')}</p>
          <h2 id="campaign-title" className="mt-5 font-display text-[3.25rem] font-extrabold uppercase leading-[0.88] tracking-[-0.02em] text-white xs:text-[3.5rem] sm:text-display-lg lg:text-display-xl 2xl:text-display-2xl">
            {t('home.campaign.titleA')}
            <br />
            {t('home.campaign.titleB')}
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-base text-white/75 sm:text-lg">{t('home.campaign.body')}</p>
          <ButtonLink to="/shop" variant="accent" size="lg" className="mt-10" rightIcon={<Arrow />}>
            {t('home.campaign.cta')}
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}

/** Football boots: large split editorial — image-led, product highlights on the side. */
export function FootballSpotlight() {
  const { t } = useT();
  const { data } = useFeaturedProducts('football', 6);
  const picks = (data ?? []).filter((p) => p.department === 'footwear').slice(0, 3);
  return (
    <section className="bg-paper-100" aria-labelledby="football-title">
      <div className="grid lg:grid-cols-[1.35fr_1fr]">
        <div className="relative min-h-[380px] overflow-hidden sm:min-h-[560px] lg:min-h-[760px]">
          <SmartImage src={IMG.kickOrangeBoot} alt={t('home.football.imageAlt')} sizes="(min-width: 1024px) 58vw, 100vw" wrapperClassName="absolute inset-0" />
          <span className="absolute bottom-0 start-0 bg-accent px-5 py-3 font-display text-lg font-bold uppercase tracking-wide text-ink sm:text-xl">{t('home.football.badge')}</span>
        </div>
        <div className="flex flex-col justify-center px-4 py-14 sm:px-10 lg:px-14 xl:px-20">
          <Reveal>
            <p className="eyebrow">{t('home.football.eyebrow')}</p>
            <h2 id="football-title" className="heading-xl mt-4">
              {t('home.football.titleA')}
              <br />
              {t('home.football.titleB')}
            </h2>
            <p className="mt-5 max-w-md text-ink-600">{t('home.football.body')}</p>
            <div className="mt-10 space-y-3">
              {picks.map((p) => (
                <Link key={p.id} to={productPath(p.slug)} className="group flex items-center gap-4 border-b border-ink/10 pb-3">
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-white">
                    <SmartImage src={p.images[0].url} alt="" sizes="64px" maxWidth={320} wrapperClassName="absolute inset-0" className="transition-transform duration-500 group-hover:scale-110" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <Price price={p.price} compareAtPrice={p.compareAtPrice} size="sm" className="mt-1" />
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              ))}
            </div>
            <ButtonLink to="/categories/football-boots" variant="primary" size="lg" className="mt-10" rightIcon={<Arrow />}>
              {t('home.football.cta')}
            </ButtonLink>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Teamwear: dark, type-led composition with an image collage of squads in kit. */
export function TeamwearSpotlight() {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden bg-ink py-16 text-white sm:py-24" aria-labelledby="teamwear-title">
      <p className="pointer-events-none absolute -end-6 top-6 select-none font-display text-[28vw] font-extrabold uppercase leading-none tracking-[-0.04em] text-white/[0.035] lg:text-[16vw]" aria-hidden>
        {t('home.teamwear.watermark')}
      </p>
      <div className="container-site relative grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal className="order-2 lg:order-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{t('home.teamwear.eyebrow')}</p>
          <h2 id="teamwear-title" className="heading-xl mt-4 text-white">
            {t('home.teamwear.titleA')}
            <br />
            {t('home.teamwear.titleB')}
          </h2>
          <p className="mt-5 max-w-md text-white/70">{t('home.teamwear.body')}</p>
          <ul className="mt-8 grid max-w-md grid-cols-3 gap-4 border-y border-white/10 py-6">
            {(
              [
                ['f1', 'f1Text'],
                ['f2', 'f2Text'],
                ['f3', 'f3Text'],
              ] as const
            ).map(([k, v]) => (
              <li key={k} className="min-w-0">
                <p className="font-display text-xl font-bold uppercase sm:text-2xl">{t(`home.teamwear.${k}`)}</p>
                <p className="mt-1 text-xs text-white/55">{t(`home.teamwear.${v}`)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink to="/categories/team-kits" variant="light" size="lg" rightIcon={<Arrow />}>
              {t('home.teamwear.cta')}
            </ButtonLink>
            <ButtonLink to="/contact" variant="outline-light" size="lg">
              {t('home.teamwear.ctaQuote')}
            </ButtonLink>
          </div>
        </Reveal>
        <div className="order-1 grid grid-cols-5 grid-rows-6 gap-3 sm:gap-4 lg:order-2">
          <div className="relative col-span-3 row-span-6 min-h-[340px] overflow-hidden sm:min-h-[520px]">
            <SmartImage src={IMG.teamWalkout} alt={t('home.teamwear.img1Alt')} sizes="(min-width: 1024px) 30vw, 60vw" wrapperClassName="absolute inset-0" />
          </div>
          <div className="relative col-span-2 row-span-3 overflow-hidden">
            <SmartImage src={IMG.teamRedKits} alt={t('home.teamwear.img2Alt')} sizes="(min-width: 1024px) 20vw, 40vw" wrapperClassName="absolute inset-0" />
          </div>
          <div className="relative col-span-2 row-span-3 overflow-hidden">
            <SmartImage src={IMG.teamHuddleStripes} alt={t('home.teamwear.img3Alt')} sizes="(min-width: 1024px) 20vw, 40vw" wrapperClassName="absolute inset-0" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Polos, tees & training: image panel + product rail. */
export function TrainingCollection() {
  const { t } = useT();
  const { data, loading, error, reload } = useFeaturedProducts('training', 10);
  return (
    <section className="py-16 sm:py-24" aria-labelledby="training-title">
      <div className="container-site">
        <SectionHeading
          eyebrow={t('home.training.eyebrow')}
          title={<span id="training-title">{t('home.training.title')}</span>}
          description={t('home.training.body')}
          action={{ label: t('home.training.cta'), href: '/categories/polo-shirts' }}
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-8">
          <Link to="/categories/polo-shirts" className="group relative hidden overflow-hidden bg-ink lg:block">
            <SmartImage src={IMG.poloModel} alt={t('home.training.imageAlt')} sizes="360px" maxWidth={800} wrapperClassName="absolute inset-0" className="transition-transform duration-700 ease-premium group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 to-transparent" />
            <div className="absolute inset-x-6 bottom-6 text-white">
              <p className="font-display text-4xl font-extrabold uppercase leading-[0.9]">{t('home.training.panelTitle')}</p>
              <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                {t('home.training.panelCta')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </p>
            </div>
          </Link>
          <div className="min-w-0">
            <ProductCarousel label={t('home.training.rail')} products={data} loading={loading} error={error} onRetry={reload} cardClassName="md:w-[31%] xl:w-[31.5%]" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Best sellers rail. */
export function BestSellers() {
  const { t } = useT();
  const { data, loading, error, reload } = useFeaturedProducts('bestseller', 10);
  return (
    <section className="bg-paper-100 py-16 sm:py-24" aria-labelledby="bestsellers-title">
      <div className="container-site">
        <SectionHeading eyebrow={t('home.bestSellers.eyebrow')} title={<span id="bestsellers-title">{t('home.bestSellers.title')}</span>} action={{ label: t('home.bestSellers.cta'), href: '/shop?sort=popular' }} />
        <div className="mt-10">
          <ProductCarousel label={t('home.bestSellers.rail')} products={data} loading={loading} error={error} onRetry={reload} />
        </div>
      </div>
    </section>
  );
}
