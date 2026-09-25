import { ArrowUpRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, Reveal, Skeleton, SmartImage } from '@/components/common';
import { PageHero } from '@/components/marketing/PageHero';
import { categoryPath } from '@/constants/routes';
import { getFeaturedCategories, getMoreCategories } from '@/data/categories';
import { getAllCollections } from '@/data/collections';
import { IMG } from '@/data/images';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useCategories } from '@/hooks/useProducts';
import NotFoundPage from '@/pages/NotFound';
import { CollectionView } from '@/pages/Shop';
import { productService } from '@/services/productService';
import type { CatalogCategory } from '@/types';
import { cn } from '@/utils/cn';
import { t as translate, tDynamic, useT } from '@/i18n';

/** Static art for departments the admin has not given an image yet. */
const fallbackImage = (slug: string) => getAllCollections().find((c) => c.key === slug)?.image;

/** Category / department names come from the API in English: prefer the translated collection title. */
const catName = (c: { slug: string; name: string }) => tDynamic(`collections.${c.slug}.title`, c.name);

function flatten(nodes: CatalogCategory[]): CatalogCategory[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

interface TileProps {
  href: string;
  image?: string | null;
  title: string;
  subtitle?: string;
  meta?: string;
  index: number;
  compact?: boolean;
}

function Tile({ href, image, title, subtitle, meta, index, compact }: TileProps) {
  return (
    <Reveal delay={(index % 3) * 60}>
      <Link
        to={href}
        className={cn('group relative block overflow-hidden bg-ink', compact ? 'aspect-square sm:aspect-[4/5]' : 'aspect-[4/5] sm:aspect-[4/3]')}
      >
        {image && (
          <SmartImage
            src={image}
            alt=""
            sizes={compact ? '(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw' : '(min-width: 1024px) 33vw, 50vw'}
            wrapperClassName="absolute inset-0"
            className="transition-transform duration-700 ease-premium group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
        <div className={cn('absolute flex items-end justify-between gap-3', compact ? 'inset-x-3 bottom-3' : 'inset-x-3 bottom-3 sm:inset-x-6 sm:bottom-6')}>
          <div className="min-w-0">
            <h3 className={cn('break-words font-display font-extrabold uppercase leading-none text-white', compact ? 'text-base sm:text-lg' : 'text-xl sm:text-4xl')}>
              {title}
            </h3>
            {subtitle && <p className="mt-1.5 line-clamp-2 text-xs text-white/75 sm:text-sm">{subtitle}</p>}
            {meta && <p className="mt-1 text-2xs font-semibold uppercase tracking-[0.12em] text-white/60">{meta}</p>}
          </div>
          {!compact && (
            <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-colors group-hover:bg-accent sm:flex">
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </div>
      </Link>
    </Reveal>
  );
}

export function CategoriesIndexPage() {
  const { t } = useT();
  usePageMeta({ title: t('catalog.categories.metaTitle'), description: t('catalog.categories.metaDescription') });
  const { data, loading, error, reload } = useCategories();
  const departments = (data ?? []).filter((c) => c.productCount > 0 || c.children.some((x) => x.productCount > 0));
  const counts = new Map(flatten(data ?? []).map((c) => [c.slug, c.productCount]));
  const countLabel = (slug: string) => {
    const n = counts.get(slug);
    return n ? t('common.labels.products', { count: n }) : undefined;
  };

  return (
    <>
      <PageHero
        title={t('catalog.categories.title')}
        eyebrow={t('catalog.categories.eyebrow')}
        description={t('catalog.categories.description')}
        crumbs={[{ label: t('catalog.crumbs.categories') }]}
      />
      <div className="container-site space-y-16 pb-24">
        <section aria-labelledby="featured-categories">
          <h2 id="featured-categories" className="heading-md mb-6">
            {t('catalog.categories.featured')}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {getFeaturedCategories().map((c, i) => (
              <li key={c.slug}>
                <Tile href={c.href} image={c.image} title={c.name} subtitle={c.description} meta={countLabel(c.slug)} index={i} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="more-categories">
          <h2 id="more-categories" className="heading-md mb-6">
            {t('catalog.categories.more')}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
            {getMoreCategories().map((c, i) => (
              <li key={c.slug}>
                <Tile href={c.href} image={c.image} title={c.name} meta={countLabel(c.slug)} index={i} compact />
              </li>
            ))}
          </ul>
        </section>

        {(loading || error || departments.length > 0) && (
          <section aria-labelledby="by-department">
            <h2 id="by-department" className="heading-md">
              {t('catalog.categories.byDepartment')}
            </h2>
            <p className="mb-6 mt-2 text-sm text-ink-500">{t('catalog.categories.departmentsHint')}</p>
            {error ? (
              <ErrorState message={error} onRetry={reload} />
            ) : loading ? (
              <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <li key={i}>
                    <Skeleton className="aspect-[16/9] w-full" />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {departments.map((c, i) => {
                  const name = catName(c);
                  const children = c.children.filter((x) => x.productCount > 0);
                  return (
                    <li key={c.id} className="min-w-0">
                      <Reveal delay={(i % 3) * 60}>
                        <Link to={categoryPath(c.slug)} className="group relative block aspect-[16/9] overflow-hidden bg-ink">
                          <SmartImage
                            src={c.imageUrl ?? fallbackImage(c.slug) ?? IMG.heroNightTraining}
                            alt=""
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            wrapperClassName="absolute inset-0"
                            className="transition-transform duration-700 ease-premium group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
                          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="font-display text-2xl font-extrabold uppercase leading-none text-white sm:text-3xl">{name}</h3>
                              <p className="mt-1.5 text-xs text-white/75 sm:text-sm">{t('common.labels.products', { count: c.productCount })}</p>
                            </div>
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-colors group-hover:bg-accent">
                              <ArrowUpRight className="h-4 w-4" aria-hidden />
                              <span className="sr-only">{t('catalog.categories.shopDepartment', { name })}</span>
                            </span>
                          </div>
                        </Link>
                      </Reveal>
                      {children.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {children.map((x) => (
                            <li key={x.id}>
                              <Link
                                to={categoryPath(x.slug)}
                                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-paper-300 px-3 text-xs font-medium hover:border-ink"
                              >
                                {catName(x)}
                                <span className="text-ink-500">{x.productCount}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function SubcategoryLinks({ category }: { category: CatalogCategory }) {
  const children = category.children.filter((c) => c.productCount > 0);
  if (!children.length) return null;
  return (
    <nav aria-label={translate('catalog.categories.subnav', { name: catName(category) })} className="border-b border-paper-200">
      <ul className="container-site scrollbar-none flex gap-6 overflow-x-auto">
        {children.map((c) => (
          <li key={c.id} className="shrink-0">
            <Link to={categoryPath(c.slug)} className={cn('relative flex h-14 items-center text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 transition-colors hover:text-ink')}>
              {catName(c)}
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

  const trail = (category.breadcrumb ?? [{ id: category.id, name: category.name, slug: category.slug }]).map((c) => ({ ...c, name: catName(c) }));
  const dept = getAllCollections().find((c) => c.key === category.slug);
  const title = catName(category);
  return (
    <CollectionView
      key={category.slug}
      collection={{
        key: category.slug,
        path: categoryPath(category.slug),
        title,
        eyebrow: dept?.eyebrow ?? (trail.length > 1 ? trail[trail.length - 2].name : translate('catalog.categories.category')),
        // Translated copy first: API descriptions are English only.
        description: dept?.description || category.description || '',
        image: category.imageUrl ?? dept?.image ?? fallbackImage(trail[0]?.slug ?? '') ?? '',
      }}
      base={{ categories: [category.slug] }}
      crumbs={[{ label: translate('catalog.crumbs.categories'), href: '/categories' }, ...trail.slice(0, -1).map((c) => ({ label: c.name, href: categoryPath(c.slug) })), { label: title }]}
      hideQuickLinks
    >
      <SubcategoryLinks category={category} />
    </CollectionView>
  );
}
