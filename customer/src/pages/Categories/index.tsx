import { ArrowUpRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Reveal, SmartImage } from '@/components/common';
import { PageHero } from '@/components/marketing/PageHero';
import { FEATURED_CATEGORIES, MORE_CATEGORIES } from '@/data/categories';
import { DEPARTMENT_COLLECTIONS } from '@/data/collections';
import { usePageMeta } from '@/hooks/usePageMeta';
import NotFoundPage from '@/pages/NotFound';
import { CollectionView } from '@/pages/Shop';

export function CategoriesIndexPage() {
  usePageMeta({ title: 'All Categories', description: 'Browse every SPORTX category — football, basketball, running, training, apparel, footwear and equipment.' });
  const all = [...FEATURED_CATEGORIES, ...MORE_CATEGORIES];
  return (
    <>
      <PageHero title="All Categories" eyebrow="Explore" description="Everything you need to train, compete and recover — organised by sport and gear type." crumbs={[{ label: 'Categories' }]} />
      <div className="container-site pb-24">
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {all.map((c, i) => (
            <li key={c.slug}>
              <Reveal delay={(i % 3) * 60}>
                <Link to={c.href} className="group relative block aspect-[4/5] overflow-hidden bg-ink sm:aspect-[4/3]">
                  <SmartImage src={c.image} alt="" sizes="(min-width: 1024px) 33vw, 50vw" wrapperClassName="absolute inset-0" className="transition-transform duration-700 ease-premium group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 sm:inset-x-6 sm:bottom-6">
                    <div>
                      <h2 className="font-display text-2xl font-extrabold uppercase leading-none text-white sm:text-4xl">{c.name}</h2>
                      <p className="mt-1.5 text-xs text-white/70 sm:text-sm">{c.description}</p>
                    </div>
                    <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-colors group-hover:bg-accent sm:flex">
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function CategoryPage() {
  const { slug } = useParams();
  const collection = DEPARTMENT_COLLECTIONS.find((c) => c.key === slug);
  if (!collection) return <NotFoundPage />;
  return <CollectionView collection={collection} />;
}
