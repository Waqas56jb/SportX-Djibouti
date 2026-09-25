import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonLink, Price, Reveal, SectionHeading, SmartImage } from '@/components/common';
import { ProductCarousel } from '@/components/product';
import { productPath } from '@/constants/routes';
import { IMG } from '@/data/images';
import { useFeaturedProducts } from '@/hooks/useProducts';

/** Full-bleed campaign: BUILT FOR THE GAME. */
export function CampaignBanner() {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white" aria-labelledby="campaign-title">
      <SmartImage src={IMG.fbStadium} alt="Floodlit football stadium packed with fans" maxWidth={1920} wrapperClassName="absolute inset-0 -z-10" className="opacity-70" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/40 to-ink/90" aria-hidden />
      <div className="container-site flex min-h-[560px] flex-col items-center justify-center py-24 text-center sm:min-h-[640px] lg:min-h-[720px]">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">The SS26 campaign</p>
          <h2 id="campaign-title" className="mt-5 font-display text-[3.5rem] font-extrabold uppercase leading-[0.85] tracking-[-0.02em] text-white sm:text-display-lg lg:text-display-xl 2xl:text-display-2xl">
            Built for
            <br />
            the game
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-base text-white/75 sm:text-lg">Performance gear for training, competition and everything between.</p>
          <ButtonLink to="/shop" variant="accent" size="lg" className="mt-10" rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
            Explore collection
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}

/** Football: large split editorial — image-led, product highlights on the side. */
export function FootballSpotlight() {
  const { data } = useFeaturedProducts('football', 4);
  const picks = (data ?? []).slice(0, 2);
  return (
    <section className="bg-paper-100" aria-labelledby="football-title">
      <div className="grid lg:grid-cols-[1.35fr_1fr]">
        <div className="relative min-h-[420px] overflow-hidden sm:min-h-[560px] lg:min-h-[760px]">
          <SmartImage src={IMG.fbKickSky} alt="Footballer striking the ball on a training pitch" sizes="(min-width: 1024px) 58vw, 100vw" wrapperClassName="absolute inset-0" />
          <span className="absolute bottom-0 left-0 bg-accent px-5 py-3 font-display text-lg font-bold uppercase tracking-wide text-ink sm:text-xl">Football</span>
        </div>
        <div className="flex flex-col justify-center px-4 py-14 sm:px-10 lg:px-14 xl:px-20">
          <Reveal>
            <p className="eyebrow">Football spotlight</p>
            <h2 id="football-title" className="heading-xl mt-4">
              Own every
              <br />
              touch
            </h2>
            <p className="mt-5 max-w-md text-ink-600">
              Engineered boots, match-grade balls and featherweight kit. Everything you need to control the game from the first whistle.
            </p>
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
            <ButtonLink to="/football" variant="primary" size="lg" className="mt-10" rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
              Shop football
            </ButtonLink>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Basketball: dark, type-led composition with an image collage. */
export function BasketballSpotlight() {
  return (
    <section className="relative overflow-hidden bg-ink py-16 text-white sm:py-24" aria-labelledby="basketball-title">
      <p className="pointer-events-none absolute -right-6 top-6 select-none font-display text-[28vw] font-extrabold uppercase leading-none tracking-[-0.04em] text-white/[0.035] lg:text-[16vw]" aria-hidden>
        Court
      </p>
      <div className="container-site relative grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal className="order-2 lg:order-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Basketball spotlight</p>
          <h2 id="basketball-title" className="heading-xl mt-4 text-white">
            Rise above
            <br />
            the rim
          </h2>
          <p className="mt-5 max-w-md text-white/70">
            Responsive cushioning, lockdown fit and traction that bites. Court shoes and game balls built for explosive play — indoors or out.
          </p>
          <ul className="mt-8 grid max-w-md grid-cols-3 gap-4 border-y border-white/10 py-6">
            {[
              ['Grip', 'Herringbone traction'],
              ['Bounce', 'Responsive foam'],
              ['Lock', 'Internal cage'],
            ].map(([k, v]) => (
              <li key={k}>
                <p className="font-display text-2xl font-bold uppercase">{k}</p>
                <p className="mt-1 text-xs text-white/55">{v}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink to="/basketball" variant="light" size="lg" rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
              Shop basketball
            </ButtonLink>
            <ButtonLink to={productPath('sportx-court-force-basketball-shoe')} variant="outline-light" size="lg">
              Court Force
            </ButtonLink>
          </div>
        </Reveal>
        <div className="order-1 grid grid-cols-5 grid-rows-6 gap-3 sm:gap-4 lg:order-2">
          <div className="relative col-span-3 row-span-6 min-h-[380px] overflow-hidden sm:min-h-[520px]">
            <SmartImage src={IMG.bbDunk} alt="Basketball player mid-dunk" sizes="(min-width: 1024px) 30vw, 60vw" wrapperClassName="absolute inset-0" />
          </div>
          <div className="relative col-span-2 row-span-3 overflow-hidden">
            <SmartImage src={IMG.shoeCourtBlack} alt="SPORTX Court Force basketball shoe" sizes="(min-width: 1024px) 20vw, 40vw" wrapperClassName="absolute inset-0" />
          </div>
          <div className="relative col-span-2 row-span-3 overflow-hidden">
            <SmartImage src={IMG.bbBallMacro} alt="Close-up of a basketball" sizes="(min-width: 1024px) 20vw, 40vw" wrapperClassName="absolute inset-0" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Training collection: image panel + product rail. */
export function TrainingCollection() {
  const { data, loading, error, reload } = useFeaturedProducts('training', 10);
  return (
    <section className="py-16 sm:py-24" aria-labelledby="training-title">
      <div className="container-site">
        <SectionHeading
          eyebrow="Training collection"
          title={<span id="training-title">Gear up. Go further.</span>}
          description="Sweat-wicking apparel, stable trainers and equipment for strength, HIIT and conditioning."
          action={{ label: 'Shop training', href: '/training' }}
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-8">
          <Link to="/training" className="group relative hidden overflow-hidden bg-ink lg:block">
            <SmartImage src={IMG.trStrongWoman} alt="Athlete preparing for a barbell lift" sizes="360px" maxWidth={800} wrapperClassName="absolute inset-0" className="transition-transform duration-700 ease-premium group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 to-transparent" />
            <div className="absolute inset-x-6 bottom-6 text-white">
              <p className="font-display text-4xl font-extrabold uppercase leading-[0.9]">Performance starts here</p>
              <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </p>
            </div>
          </Link>
          <div className="min-w-0">
            <ProductCarousel label="Training products" products={data} loading={loading} error={error} onRetry={reload} cardClassName="md:w-[31%] xl:w-[31.5%]" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Best sellers rail. */
export function BestSellers() {
  const { data, loading, error, reload } = useFeaturedProducts('bestseller', 10);
  return (
    <section className="bg-paper-100 py-16 sm:py-24" aria-labelledby="bestsellers-title">
      <div className="container-site">
        <SectionHeading eyebrow="Athlete approved" title={<span id="bestsellers-title">Best Sellers</span>} action={{ label: 'Shop best sellers', href: '/shop?sort=popular' }} />
        <div className="mt-10">
          <ProductCarousel label="Best selling products" products={data} loading={loading} error={error} onRetry={reload} />
        </div>
      </div>
    </section>
  );
}
