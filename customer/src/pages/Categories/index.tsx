import { ArrowUpRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, Reveal, Skeleton, SmartImage } from '@/components/common';
import { PageHero } from '@/components/marketing/PageHero';
import { categoryPath } from '@/constants/routes';
import { FEATURED_CATEGORIES } from '@/data/categories';
import { DEPARTMENT_COLLECTIONS } from '@/data/collections';
import { IMG } from '@/data/images';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useCategories } from '@/hooks/useProducts';
import NotFoundPage from '@/pages/NotFound';
import { CollectionView } from '@/pages/Shop';
import { productService } from '@/services/productService';
import type { CatalogCategory } from '@/types';
import { cn } from '@/utils/cn';
import { pluralize } from '@/utils/format';

/** Static art for departments the admin has not given an image yet. */
const fallbackImage = (slug: string) => DEPARTMENT_COLLECTIONS.find((c) => c.key === slug)?.image;

function Tile({ href, image, title, subtitle, index }: { href: string; image?: string | null; title: string; subtitle: string; index: number }) {
  return (
    <Reveal delay={(index % 3) * 60}>
      <Link to={href} className="group relative block aspect-[4/5] overflow-hidden bg-ink sm:aspect-[4/3]">
        {image && <SmartImage src={image} alt="" sizes="(min-width: 1024px) 33vw, 50vw" wrapperClassName="absolute inset-0" className="transition-transform duration-700 ease-premium group-hover:scale-105" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 sm:inset-x-6 sm:bottom-6">
          <div>
            <h2 className="font-display text-2xl font-extrabold uppercase leading-none text-white sm:text-4xl">{title}</h2>
            <p className="mt-1.5 text-xs text-white/70 sm:text-sm">{subtitle}</p>
          </div>
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-colors group-hover:bg-accent sm:flex">
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

export function CategoriesIndexPage() {
  usePageMeta({ title: 'All Categories', description: 'Browse every SPORTX category — football, basketball, running, training, apparel, footwear and equipment.' });
  const { data, loading, error, reload } = useCategories();
  const departments = (data ?? []).filter((c) => c.productCount > 0 || c.children.some((x) => x.productCount > 0));

  return (
    <>
      <PageHero title="All Categories" eyebrow="Explore" description="Everything you need to train, compete and recover — organised by sport and gear type." crumbs={[{ label: 'Categories' }]} />
      <div className="container-site space-y-16 pb-24">
        <section aria-labelledby="by-sport">
          <h2 id="by-sport" className="heading-md mb-6">
            Shop by sport
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {FEATURED_CATEGORIES.filter((c) => !c.href.startsWith('/categories')).map((c, i) => (
              <li key={c.slug}>
                <Tile href={c.href} image={c.image} title={c.name} subtitle={c.description} index={i} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="by-category">
          <h2 id="by-category" className="heading-md mb-6">
            Shop by category
          </h2>
          {error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : loading ? (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3" aria-busy="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <li key={i}>
                  <Skeleton className="aspect-[4/5] w-full sm:aspect-[4/3]" />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {departments.map((c, i) => (
                <li key={c.id}>
                  <Tile href={categoryPath(c.slug)} image={c.imageUrl ?? fallbackImage(c.slug) ?? IMG.trDarkAthlete} title={c.name} subtitle={pluralize(c.productCount, 'product')} index={i} />
                  {c.children.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {c.children
                        .filter((x) => x.productCount > 0)
                        .map((x) => (
                          <li key={x.id}>
                            <Link to={categoryPath(x.slug)} className="inline-flex min-h-[36px] items-center rounded-full border border-paper-300 px-3 text-xs font-medium hover:border-ink">
                              {x.name}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function SubcategoryLinks({ category }: { category: CatalogCategory }) {
  const children = category.children.filter((c) => c.productCount > 0);
  if (!children.length) return null;
  return (
    <nav aria-label={`${category.name} categories`} className="border-b border-paper-200">
      <ul className="container-site scrollbar-none flex gap-6 overflow-x-auto">
        {children.map((c) => (
          <li key={c.id} className="shrink-0">
            <Link to={categoryPath(c.slug)} className={cn('relative flex h-14 items-center text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 transition-colors hover:text-ink')}>
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CategoryPage() {
  const { slug = '' } = useParams();
  const { data: category, loading, error, reload } = useAsync(() => productService.category(slug), [slug]);

  if (loading) {
    return (
      <div className="container-site space-y-6 py-10" aria-busy="true">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} className="py-24" />;
  if (!category) return <NotFoundPage />;

  const trail = category.breadcrumb ?? [{ id: category.id, name: category.name, slug: category.slug }];
  const dept = DEPARTMENT_COLLECTIONS.find((c) => c.key === category.slug);
  return (
    <CollectionView
      key={category.slug}
      collection={{
        key: category.slug,
        path: categoryPath(category.slug),
        title: category.name,
        eyebrow: dept?.eyebrow ?? (trail.length > 1 ? trail[trail.length - 2].name : 'Category'),
        description: category.description || dept?.description || '',
        image: category.imageUrl ?? dept?.image ?? fallbackImage(trail[0]?.slug ?? '') ?? '',
      }}
      base={{ categories: [category.slug] }}
      crumbs={[{ label: 'Categories', href: '/categories' }, ...trail.slice(0, -1).map((t) => ({ label: t.name, href: categoryPath(t.slug) })), { label: category.name }]}
      hideQuickLinks
    >
      <SubcategoryLinks category={category} />
    </CollectionView>
  );
}
