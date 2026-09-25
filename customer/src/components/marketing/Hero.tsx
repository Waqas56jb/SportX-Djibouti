import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonLink, SmartImage } from '@/components/common';
import { productPath } from '@/constants/routes';
import { IMG } from '@/data/images';

/**
 * Homepage hero: full-bleed athletic photography, oversized condensed type
 * and a featured-product card anchoring the composition on desktop.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white" aria-labelledby="hero-title">
      <SmartImage
        src={IMG.trDarkAthlete}
        alt="Athlete preparing for a heavy lift in a dark training gym"
        priority
        maxWidth={1920}
        wrapperClassName="absolute inset-0 -z-10 bg-ink"
        className="object-[60%_30%] opacity-90"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/70 to-ink/10" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-transparent to-transparent" aria-hidden />

      <div className="container-site relative flex min-h-[calc(100svh-100px)] flex-col justify-end pb-10 pt-24 sm:min-h-[680px] sm:pb-14 lg:min-h-[760px] 2xl:min-h-[840px]">
        <div className="max-w-4xl">
          <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.3em] text-accent [animation-delay:80ms]">
            New season · Performance collection
          </p>
          <h1 id="hero-title" className="display-hero mt-5 animate-fade-up text-white [animation-delay:160ms]">
            Train
            <br />
            without <span className="text-transparent [-webkit-text-stroke:2px_#fff] sm:[-webkit-text-stroke:3px_#fff]">limits</span>
          </h1>
          <p className="mt-6 max-w-md animate-fade-up text-base text-white/75 [animation-delay:260ms] sm:text-lg">
            Premium sportswear and equipment built for athletes who demand more.
          </p>
          <div className="mt-9 grid animate-fade-up grid-cols-1 gap-3 [animation-delay:340ms] sm:flex">
            <ButtonLink to="/men" variant="light" size="lg" rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
              Shop Men
            </ButtonLink>
            <ButtonLink to="/women" variant="outline-light" size="lg" rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
              Shop Women
            </ButtonLink>
          </div>
        </div>

        <div className="mt-14 flex items-end justify-between gap-6 border-t border-white/15 pt-6">
          <dl className="grid grid-cols-3 gap-6 sm:gap-12">
            {[
              ['40+', 'Performance products'],
              ['5', 'Sports covered'],
              ['24/7', 'Shop online'],
            ].map(([k, v]) => (
              <div key={v}>
                <dt className="sr-only">{v}</dt>
                <dd className="font-display text-3xl font-bold leading-none sm:text-4xl">{k}</dd>
                <dd className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-white/55">{v}</dd>
              </div>
            ))}
          </dl>

          <Link
            to={productPath('sportx-velocity-runner')}
            className="group hidden w-[300px] shrink-0 items-center gap-4 bg-white/10 p-3 pr-5 backdrop-blur-md transition-colors hover:bg-white/15 lg:flex"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-white">
              <SmartImage src={IMG.shoeRedKnit} alt="" sizes="80px" maxWidth={320} wrapperClassName="absolute inset-0" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Featured</p>
              <p className="mt-1 truncate text-sm font-semibold">SPORTX Velocity Runner</p>
              <p className="mt-0.5 text-xs text-white/60">Engineered for every pace</p>
            </div>
            <ArrowUpRight className="h-5 w-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
