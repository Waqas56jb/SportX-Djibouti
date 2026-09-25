import { useEffect, useState } from 'react';
import { FileWarning } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { PageHero } from '@/components/marketing/PageHero';
import { shippingService, type ShippingMethodsResult } from '@/services/shippingService';
import { SITE } from '@/constants/site';
import { usePageMeta } from '@/hooks/usePageMeta';
import { t, tDynamic } from '@/i18n';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';

type LegalKey = 'privacy' | 'terms' | 'shipping' | 'returns';

interface Section {
  heading: string;
  body: string[];
}

/**
 * Section layout per document: number of paragraphs for each `s<n>` section, or `'contact'` for the
 * store contact line. Text lives in `pages.legal.<doc>.s<n>Heading` / `s<n>Body<m>`.
 *
 * DRAFT CONTENT. These documents are structural placeholders written in plain language. They must
 * be reviewed and replaced by the business’s final, legally approved policies before launch.
 */
const LAYOUT: Record<LegalKey, (number | 'contact')[]> = {
  privacy: [2, 1, 1, 1, 1, 'contact'],
  terms: [1, 1, 1, 1, 1, 1, 'contact'],
  shipping: [1, 1, 1, 1, 1],
  returns: [3, 1, 1, 1],
};

/** Shipping sections filled from the live store configuration (by section number). */
const SHIPPING_LIVE = { options: 2, free: 3 } as const;

const NAV: LegalKey[] = ['privacy', 'terms', 'shipping', 'returns'];

function buildSections(doc: LegalKey): Section[] {
  const contactLine = `${SITE.name}, ${SITE.contact.addressLines.join(', ')} — ${SITE.contact.phone}`;
  return LAYOUT[doc].map((spec, i) => {
    const base = `pages.legal.${doc}.s${i + 1}`;
    return {
      heading: tDynamic(`${base}Heading`, ''),
      body: spec === 'contact' ? [contactLine] : Array.from({ length: spec }, (_, m) => tDynamic(`${base}Body${m + 1}`, '')),
    };
  });
}

/** Live delivery options and free-delivery threshold from the store's shipping settings. */
function liveShippingBodies(cfg: ShippingMethodsResult): Record<number, string[]> {
  const days = (a: number, b: number) =>
    a === b ? t('pages.legal.shipping.businessDays', { count: a }) : t('pages.legal.shipping.businessDaysRange', { min: a, max: b });
  return {
    [SHIPPING_LIVE.options]: cfg.methods.map((m) =>
      t('pages.legal.shipping.methodLine', {
        name: m.name,
        description: m.description ?? '',
        price: m.price === 0 ? t('pages.legal.shipping.methodFree') : `${formatPrice(m.price)}.`,
        eta: days(m.eta[0], m.eta[1]),
      }),
    ),
    [SHIPPING_LIVE.free]: [
      cfg.freeShippingThreshold ? t('pages.legal.shipping.freeOver', { amount: formatPrice(cfg.freeShippingThreshold) }) : t('pages.legal.shipping.noFree'),
    ],
  };
}

export default function LegalPage({ doc }: { doc: LegalKey }) {
  const [shipping, setShipping] = useState<ShippingMethodsResult | null>(null);
  useEffect(() => {
    if (doc !== 'shipping') return;
    let alive = true;
    shippingService
      .methods()
      .then((r) => alive && setShipping(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [doc]);

  const title = tDynamic(`pages.legal.${doc}.title`, doc);
  const description = tDynamic(`pages.legal.${doc}.description`, '');
  const live = doc === 'shipping' && shipping ? liveShippingBodies(shipping) : null;
  const sections = buildSections(doc).map((s, i) => (live?.[i + 1] ? { ...s, body: live[i + 1] } : s));
  usePageMeta({ title, description });

  return (
    <>
      <PageHero eyebrow={t('pages.legal.eyebrow')} title={title} description={description} crumbs={[{ label: title }]} />
      <div className="container-site grid grid-cols-1 gap-10 pb-24 lg:grid-cols-[220px_1fr] lg:gap-16">
        <nav aria-label={t('pages.legal.navLabel')} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ul className="scrollbar-none flex gap-2 overflow-x-auto lg:flex-col lg:gap-0.5">
            {NAV.map((key) => (
              <li key={key} className="shrink-0">
                <NavLink
                  to={`/${key}`}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-[40px] items-center border px-4 text-sm transition-colors lg:border-0 lg:border-s-2',
                      isActive ? 'border-ink font-semibold text-ink' : 'border-paper-300 text-ink-500 hover:text-ink lg:border-transparent',
                    )
                  }
                >
                  {t(`pages.legal.nav.${key}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <article className="min-w-0 max-w-prose">
          <div className="mb-10 flex gap-3 border border-warning/20 bg-warning-50 p-4 text-sm text-warning" role="note">
            <FileWarning className="h-5 w-5 shrink-0" aria-hidden />
            <p>
              <strong className="font-semibold">{t('pages.legal.draftTitle')}</strong> {t('pages.legal.draftBody')}
            </p>
          </div>
          <ol className="space-y-10">
            {sections.map((s, i) => (
              <li key={`${doc}-${i}`}>
                <h2 className="break-words font-display text-2xl font-bold uppercase">
                  <span className="me-3 text-accent-dark">{String(i + 1).padStart(2, '0')}</span>
                  {s.heading}
                </h2>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-600">
                  {s.body.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </>
  );
}
