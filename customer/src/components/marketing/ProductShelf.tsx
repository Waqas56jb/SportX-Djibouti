import { useMemo, useState } from 'react';
import { ErrorState, SectionHeading } from '@/components/common';
import { ProductGrid, ProductGridSkeleton } from '@/components/product';
import { useFeaturedProducts } from '@/hooks/useProducts';
import { DEPARTMENT_LABELS } from '@/constants/labels';
import { useT } from '@/i18n';
import type { Department } from '@/types';
import { cn } from '@/utils/cn';

const TABS: ('all' | Department)[] = ['all', 'footwear', 'apparel', 'equipment', 'accessories'];

/** "New Arrivals" grid with department tabs that filter in place. */
export function NewArrivals() {
  const { t } = useT();
  const { data, loading, error, reload } = useFeaturedProducts('new', 12);
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');

  const visible = useMemo(() => (data ?? []).filter((p) => tab === 'all' || p.department === tab).slice(0, 8), [data, tab]);
  const available = useMemo(() => TABS.filter((k) => k === 'all' || (data ?? []).some((p) => p.department === k)), [data]);

  return (
    <section className="container-site py-16 sm:py-24" aria-labelledby="new-arrivals-title">
      <SectionHeading eyebrow={t('home.newArrivals.eyebrow')} title={<span id="new-arrivals-title">{t('home.newArrivals.title')}</span>} action={{ label: t('home.newArrivals.cta'), href: '/new-arrivals' }} />
      <div className="scrollbar-none -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label={t('home.newArrivals.tabsLabel')}>
        {available.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              'min-h-[40px] shrink-0 rounded-full border px-5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors',
              tab === k ? 'border-ink bg-ink text-white' : 'border-paper-300 text-ink hover:border-ink',
            )}
          >
            {k === 'all' ? t('home.newArrivals.all') : DEPARTMENT_LABELS[k]}
          </button>
        ))}
      </div>
      <div className="mt-8" role="tabpanel">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <ProductGridSkeleton count={8} /> : <ProductGrid products={visible} />}
      </div>
    </section>
  );
}
