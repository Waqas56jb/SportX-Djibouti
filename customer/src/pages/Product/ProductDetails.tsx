import { useState } from 'react';
import { AccordionItem } from '@/components/common';
import { SizeGuideTable } from '@/components/product';
import { SITE } from '@/constants/site';
import type { Product } from '@/types';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';
import { FREE_SHIPPING_THRESHOLD } from '@/constants/commerce';

type TabKey = 'description' | 'features' | 'specifications' | 'size-guide' | 'shipping';

function Panel({ tab, product }: { tab: TabKey; product: Product }) {
  switch (tab) {
    case 'description':
      return (
        <div className="max-w-prose space-y-4 text-[15px] leading-relaxed text-ink-600">
          <p className="text-lg text-ink">{product.shortDescription}</p>
          <p>{product.description}</p>
        </div>
      );
    case 'features':
      return (
        <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {product.features.map((f, i) => (
            <li key={f} className="flex gap-4 border-t border-paper-200 pt-4">
              <span className="font-display text-lg font-bold text-accent-dark">0{i + 1}</span>
              <span className="text-[15px] text-ink-700">{f}</span>
            </li>
          ))}
        </ul>
      );
    case 'specifications':
      return (
        <dl className="max-w-2xl divide-y divide-paper-200 border-y border-paper-200">
          {[{ label: 'Brand', value: product.brand }, ...product.specifications, { label: 'SKU', value: product.variants[0]?.sku.split('-').slice(0, 3).join('-') ?? '—' }].map((s) => (
            <div key={s.label} className="grid grid-cols-[140px_1fr] gap-4 py-3.5 text-sm sm:grid-cols-[200px_1fr]">
              <dt className="font-semibold text-ink">{s.label}</dt>
              <dd className="text-ink-600">{s.value}</dd>
            </div>
          ))}
        </dl>
      );
    case 'size-guide':
      return <SizeGuideTable type={product.sizeGuide} />;
    case 'shipping':
      return (
        <div className="grid max-w-3xl gap-8 text-[15px] leading-relaxed text-ink-600 sm:grid-cols-2">
          <div>
            <h3 className="heading-sm text-ink">Delivery</h3>
            <p className="mt-3">
              We deliver across Djibouti. Delivery is free on orders over {formatPrice(FREE_SHIPPING_THRESHOLD)}; options and timings are confirmed at checkout.
            </p>
            <p className="mt-3">Prefer to collect? Choose Store Pickup and collect from {SITE.contact.addressLines.slice(0, 2).join(', ')}.</p>
          </div>
          <div>
            <h3 className="heading-sm text-ink">Returns & exchanges</h3>
            <p className="mt-3">Unworn items in their original condition and packaging can be returned or exchanged. Visit our Returns page for full details.</p>
          </div>
        </div>
      );
  }
}

/** Tabs on desktop, accordion on mobile — same content, suited to each context. */
export function ProductDetails({ product }: { product: Product }) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'description', label: 'Description' },
    { key: 'features', label: 'Features' },
    { key: 'specifications', label: 'Specifications' },
    ...(product.sizeGuide !== 'none' ? [{ key: 'size-guide' as const, label: 'Size Guide' }] : []),
    { key: 'shipping', label: 'Shipping & Returns' },
  ];
  const [active, setActive] = useState<TabKey>('description');

  return (
    <section className="border-t border-paper-200 py-12 sm:py-16" aria-label="Product details">
      <div className="hidden lg:block">
        <div role="tablist" aria-label="Product information" className="flex gap-10 border-b border-paper-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              id={`tab-${t.key}`}
              type="button"
              role="tab"
              aria-selected={active === t.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setActive(t.key)}
              className={cn(
                'relative -mb-px pb-4 text-xs font-semibold uppercase tracking-[0.14em] transition-colors',
                active === t.key ? 'text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-ink' : 'text-ink-500 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} className="animate-fade-in pt-10" key={active}>
          <Panel tab={active} product={product} />
        </div>
      </div>

      <div className="lg:hidden">
        {tabs.map((t, i) => (
          <AccordionItem key={t.key} title={t.label} defaultOpen={i === 0} className={i === 0 ? 'border-t' : undefined}>
            <Panel tab={t.key} product={product} />
          </AccordionItem>
        ))}
      </div>
    </section>
  );
}
