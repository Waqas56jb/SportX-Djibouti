import { useState } from 'react';
import { AccordionItem } from '@/components/common';
import { SizeGuideTable } from '@/components/product';
import { SITE } from '@/constants/site';
import type { Product } from '@/types';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';
import { t } from '@/i18n';

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
            <li key={f} className="flex min-w-0 gap-4 border-t border-paper-200 pt-4">
              <span className="ltr-text font-display text-lg font-bold text-accent-dark">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-[15px] text-ink-700">{f}</span>
            </li>
          ))}
        </ul>
      );
    case 'specifications':
      return (
        <dl className="max-w-2xl divide-y divide-paper-200 border-y border-paper-200">
          {[{ label: t('product.details.brand'), value: product.brand }, ...product.specifications, { label: t('product.details.sku'), value: product.variants[0]?.sku.split('-').slice(0, 3).join('-') || '—', ltr: true }].map((s) => (
            <div key={s.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-3.5 text-sm sm:grid-cols-[200px_1fr]">
              <dt className="font-semibold text-ink">{s.label}</dt>
              <dd className="break-words text-ink-600">{'ltr' in s && s.ltr ? <span className="ltr-text">{s.value}</span> : s.value}</dd>
            </div>
          ))}
        </dl>
      );
    case 'size-guide':
      return <SizeGuideTable type={product.sizeGuide} category={product.category} />;
    case 'shipping':
      return (
        <div className="grid max-w-3xl gap-8 text-[15px] leading-relaxed text-ink-600 sm:grid-cols-2">
          <div>
            <h3 className="heading-sm text-ink">{t('product.details.deliveryTitle')}</h3>
            <p className="mt-3">
              {t('product.details.deliveryBody')}
              {product.shipping?.freeShippingThreshold ? ` ${t('product.details.freeOver', { price: formatPrice(product.shipping.freeShippingThreshold) })}` : ''} {t('product.details.confirmed')}
            </p>
            {product.shipping && product.shipping.methods.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {product.shipping.methods.map((m) => (
                  <li key={m.code} className="flex justify-between gap-4">
                    <span>
                      <span className="font-semibold text-ink">{m.name}</span>
                      {m.maxDays > 0 && <span className="text-ink-500"> · {m.minDays === m.maxDays ? t('product.details.days', { count: m.minDays }) : t('product.details.dayRange', { min: m.minDays, max: m.maxDays })}</span>}
                    </span>
                    <span className="tabular-nums">{m.price === 0 ? t('common.labels.free') : formatPrice(m.price)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3">{t('product.details.pickup', { address: SITE.contact.addressLines.slice(0, 2).join(', ') })}</p>
          </div>
          <div>
            <h3 className="heading-sm text-ink">{t('product.details.returnsTitle')}</h3>
            <p className="mt-3">{t('product.details.returnsBody')}</p>
          </div>
        </div>
      );
  }
}

/** Tabs on desktop, accordion on mobile — same content, suited to each context. */
export function ProductDetails({ product }: { product: Product }) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'description', label: t('product.details.description') },
    { key: 'features', label: t('product.details.features') },
    { key: 'specifications', label: t('product.details.specifications') },
    ...(product.sizeGuide !== 'none' ? [{ key: 'size-guide' as const, label: t('product.details.sizeGuide') }] : []),
    { key: 'shipping', label: t('product.details.shipping') },
  ];
  const [active, setActive] = useState<TabKey>('description');

  return (
    <section className="border-t border-paper-200 py-12 sm:py-16" aria-label={t('product.details.section')}>
      <div className="hidden lg:block">
        <div role="tablist" aria-label={t('product.details.info')} className="flex gap-10 border-b border-paper-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={active === tab.key}
              aria-controls={`panel-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className={cn(
                'relative -mb-px pb-4 text-xs font-semibold uppercase tracking-[0.14em] transition-colors',
                active === tab.key ? 'text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-ink' : 'text-ink-500 hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} className="animate-fade-in pt-10" key={active}>
          <Panel tab={active} product={product} />
        </div>
      </div>

      <div className="lg:hidden">
        {tabs.map((tab, i) => (
          <AccordionItem key={tab.key} title={tab.label} defaultOpen={i === 0} className={i === 0 ? 'border-t' : undefined}>
            <Panel tab={tab.key} product={product} />
          </AccordionItem>
        ))}
      </div>
    </section>
  );
}
