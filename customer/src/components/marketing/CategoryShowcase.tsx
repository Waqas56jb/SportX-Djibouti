import { ArrowUpRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Reveal, SectionHeading, SmartImage } from '@/components/common';
import { getFeaturedCategories } from '@/data/categories';
import { useT } from '@/i18n';
import { cn } from '@/utils/cn';

/**
 * Editorial category grid. Two large feature tiles lead, followed by four
 * supporting tiles — not a uniform template grid.
 */
export function CategoryShowcase() {
  const { t } = useT();
  const categories = useMemo(getFeaturedCategories, []);
  return (
    <section className="container-site py-16 sm:py-24" aria-labelledby="categories-title">
      <SectionHeading
        eyebrow={t('home.categories.eyebrow')}
        title={<span id="categories-title">{t('home.categories.title')}</span>}
        description={t('home.categories.body')}
        action={{ label: t('home.categories.all'), href: '/categories' }}
      />
      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-[repeat(2,minmax(0,1fr))]">
        {categories.map((c, i) => {
          const feature = i < 2;
          return (
            <Reveal key={c.slug} delay={i * 60} className={cn(feature && 'col-span-2 lg:col-span-1 lg:row-span-2', 'min-h-0')}>
              <Link to={c.href} className="group relative block h-full overflow-hidden bg-ink">
                <div className={cn('relative', feature ? 'aspect-[4/3] sm:aspect-[16/9] lg:aspect-auto lg:h-full lg:min-h-[560px]' : 'aspect-[4/5] lg:aspect-auto lg:h-full lg:min-h-[272px]')}>
                  <SmartImage
                    src={c.image}
                    alt=""
                    sizes={feature ? '(min-width: 1024px) 25vw, 100vw' : '(min-width: 1024px) 25vw, 50vw'}
                    wrapperClassName="absolute inset-0"
                    className="transition-transform duration-[900ms] ease-premium group-hover:scale-[1.06]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/15 to-transparent transition-opacity duration-500 group-hover:from-ink/95" />
                  <span className="absolute start-4 top-4 font-display text-sm font-semibold text-white/70 sm:start-5 sm:top-5">0{i + 1}</span>
                  <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 text-white sm:inset-x-5 sm:bottom-5 sm:gap-3">
                    <div className="min-w-0">
                      <h3 className={cn('break-words font-display font-extrabold uppercase leading-[0.95] text-white', feature ? 'text-4xl sm:text-5xl' : 'text-xl xs:text-2xl sm:text-3xl')}>{c.name}</h3>
                      <p className="mt-1.5 line-clamp-2 text-xs text-white/70 sm:text-sm">{c.description}</p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-all duration-300 group-hover:bg-accent sm:h-11 sm:w-11">
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" aria-hidden />
                    </span>
                  </div>
                </div>
                <span className="sr-only">{t('home.categories.shop', { name: c.name })}</span>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
