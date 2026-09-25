import { useMemo, useState } from 'react';
import { ErrorState, SectionHeading } from '@/components/common';
import { ProductGrid, ProductGridSkeleton } from '@/components/product';
import { useFeaturedProducts } from '@/hooks/useProducts';
import type { Department } from '@/types';
import { cn } from '@/utils/cn';

const TABS: { key: 'all' | Department; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'footwear', label: 'Footwear' },
  { key: 'apparel', label: 'Apparel' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'accessories', label: 'Accessories' },
];

/** "New Arrivals" grid with department tabs that filter in place. */
export function NewArrivals() {
  const { data, loading, error, reload } = useFeaturedProducts('new', 12);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all');

  const visible = useMemo(() => (data ?? []).filter((p) => tab === 'all' || p.department === tab).slice(0, 8), [data, tab]);
  const available = useMemo(() => TABS.filter((t) => t.key === 'all' || (data ?? []).some((p) => p.department === t.key)), [data]);

  return (
    <section className="container-site py-16 sm:py-24" aria-labelledby="new-arrivals-title">
      <SectionHeading eyebrow="Just landed" title={<span id="new-arrivals-title">New Arrivals</span>} action={{ label: 'Shop new arrivals', href: '/new-arrivals' }} />
      <div className="scrollbar-none -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter new arrivals">
        {available.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'min-h-[40px] shrink-0 rounded-full border px-5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors',
              tab === t.key ? 'border-ink bg-ink text-white' : 'border-paper-300 text-ink hover:border-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-8" role="tabpanel">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <ProductGridSkeleton count={8} /> : <ProductGrid products={visible} />}
      </div>
    </section>
  );
}
