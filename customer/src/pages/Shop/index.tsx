import { useCallback, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHero } from '@/components/marketing/PageHero';
import { CatalogView } from '@/components/product/CatalogView';
import { COLLECTIONS, getCollection, type Collection } from '@/data/collections';
import { usePageMeta } from '@/hooks/usePageMeta';
import type { MultiFilterKey } from '@/hooks/useCatalogParams';
import type { ProductQuery } from '@/types';
import type { Crumb } from '@/components/common';
import { pluralize } from '@/utils/format';
import { cn } from '@/utils/cn';
import NotFoundPage from '@/pages/NotFound';

/** Facets that are redundant on a given collection. */
const HIDDEN_FILTERS: Partial<Record<string, MultiFilterKey[]>> = {
  football: ['sport'],
  basketball: ['sport'],
  running: ['sport'],
  training: ['sport'],
  kids: ['gender'],
};

const QUICK_LINKS = ['men', 'women', 'kids', 'football', 'basketball', 'running', 'training', 'equipment', 'new-arrivals', 'sale'];

interface CollectionViewProps {
  collection: Collection;
  /** Fixed API query for this page (defaults to `{ collection: key }`). */
  base?: Pick<ProductQuery, 'collection' | 'categories'>;
  crumbs?: Crumb[];
  /** Hide the collection quick links (category pages). */
  hideQuickLinks?: boolean;
  children?: ReactNode;
}

export function CollectionView({ collection, base, crumbs: crumbsProp, hideQuickLinks, children }: CollectionViewProps) {
  const [total, setTotal] = useState<number | null>(null);
  const onTotal = useCallback((n: number) => setTotal(n), []);

  usePageMeta({ title: collection.title, description: collection.description, path: collection.path, image: collection.image });

  const crumbs = crumbsProp ?? (collection.key === 'shop' ? [{ label: 'Shop' }] : [{ label: 'Shop', href: '/shop' }, { label: collection.title }]);

  return (
    <>
      <PageHero
        eyebrow={collection.eyebrow}
        title={collection.title}
        description={collection.description}
        image={collection.image}
        crumbs={crumbs}
        meta={total !== null ? pluralize(total, 'product') : ' '}
      />
      {children}
      {!hideQuickLinks && (
      <nav aria-label="Collections" className="border-b border-paper-200">
        <ul className="container-site scrollbar-none flex gap-6 overflow-x-auto">
          {QUICK_LINKS.map((key) => {
            const c = COLLECTIONS.find((x) => x.key === key)!;
            const active = c.key === collection.key;
            return (
              <li key={key} className="shrink-0">
                <Link
                  to={c.path}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-14 items-center text-xs font-semibold uppercase tracking-[0.12em] transition-colors',
                    active ? 'text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-ink' : 'text-ink-500 hover:text-ink',
                    key === 'sale' && !active && 'text-accent-dark',
                  )}
                >
                  {c.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      )}
      <div className="container-site pb-24 pt-6">
        <CatalogView key={collection.key} base={base ?? { collection: collection.key }} hideFilters={HIDDEN_FILTERS[collection.key]} onTotal={onTotal} />
      </div>
    </>
  );
}

/** Route element factory: `<ShopPage collectionKey="men" />`. */
export default function ShopPage({ collectionKey = 'shop' }: { collectionKey?: string }) {
  const collection = getCollection(collectionKey);
  if (!collection) return <NotFoundPage />;
  return <CollectionView collection={collection} />;
}
