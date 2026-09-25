import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ButtonLink, Price, Skeleton, SmartImage } from '@/components/common';
import { productPath } from '@/constants/routes';
import { useFeaturedProducts } from '@/hooks/useProducts';
import { useCountdown } from '@/hooks/useUi';
import { discountPercent } from '@/utils/product';

/** Demo campaign window: ends at the next Sunday 23:59 local time. */
function nextSundayMidnight() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(23, 59, 59, 0);
  return d;
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[64px] border border-white/15 px-3 py-3 text-center sm:min-w-[76px]">
      <p className="font-display text-3xl font-bold tabular-nums leading-none sm:text-4xl">{String(value).padStart(2, '0')}</p>
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-white/50">{label}</p>
    </div>
  );
}

export function FlashSale() {
  const target = useMemo(nextSundayMidnight, []);
  const t = useCountdown(target);
  const { data, loading } = useFeaturedProducts('sale', 4);
  const lead = data?.[0];
  const rest = (data ?? []).slice(1, 4);

  return (
    <section className="bg-ink text-white" aria-labelledby="flash-title">
      <div className="container-site grid gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden /> Limited release
          </p>
          <h2 id="flash-title" className="heading-xl mt-4 text-white">
            The weekend
            <br />
            drop
          </h2>
          <p className="mt-5 max-w-md text-white/70">Selected performance essentials at reduced prices. Ends Sunday at midnight — while stock lasts.</p>
          <div className="mt-8 flex gap-2 sm:gap-3" role="timer" aria-live="off" aria-label={`Sale ends in ${t.days} days ${t.hours} hours ${t.minutes} minutes`}>
            <TimeBlock value={t.days} label="Days" />
            <TimeBlock value={t.hours} label="Hours" />
            <TimeBlock value={t.minutes} label="Mins" />
            <TimeBlock value={t.seconds} label="Secs" />
          </div>
          <ButtonLink to="/sale" variant="accent" size="lg" className="mt-10" rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}>
            Shop the sale
          </ButtonLink>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {loading || !lead ? (
            <>
              <Skeleton className="col-span-2 aspect-[16/10] bg-white/10 before:via-white/10" />
              <Skeleton className="aspect-square bg-white/10 before:via-white/10" />
              <Skeleton className="aspect-square bg-white/10 before:via-white/10" />
            </>
          ) : (
            <>
              <Link to={productPath(lead.slug)} className="group relative col-span-2 block aspect-[16/10] overflow-hidden bg-white/5">
                <SmartImage src={lead.images[0].url} alt={lead.images[0].alt} sizes="(min-width: 1024px) 45vw, 100vw" wrapperClassName="absolute inset-0" className="transition-transform duration-700 ease-premium group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />
                <span className="absolute left-4 top-4 bg-accent px-3 py-1.5 font-display text-xl font-bold text-ink">−{discountPercent(lead.price, lead.compareAtPrice)}%</span>
                <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold sm:text-base">{lead.name}</p>
                    <Price price={lead.price} compareAtPrice={lead.compareAtPrice} tone="light" className="mt-1" />
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
                </div>
              </Link>
              {rest.slice(0, 2).map((p) => (
                <Link key={p.id} to={productPath(p.slug)} className="group relative block aspect-square overflow-hidden bg-white/5">
                  <SmartImage src={p.images[0].url} alt={p.images[0].alt} sizes="(min-width: 1024px) 22vw, 50vw" wrapperClassName="absolute inset-0" className="transition-transform duration-700 ease-premium group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />
                  <span className="absolute left-3 top-3 bg-accent px-2 py-1 text-xs font-bold text-ink">−{discountPercent(p.price, p.compareAtPrice)}%</span>
                  <div className="absolute inset-x-3 bottom-3">
                    <p className="line-clamp-1 text-xs font-semibold sm:text-sm">{p.name}</p>
                    <Price price={p.price} compareAtPrice={p.compareAtPrice} size="sm" tone="light" className="mt-0.5" />
                  </div>
                </Link>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
