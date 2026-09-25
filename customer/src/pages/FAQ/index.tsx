import { Phone, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccordionItem } from '@/components/common';
import { PageHero } from '@/components/marketing/PageHero';
import { SITE } from '@/constants/site';
import { getFaqGroups } from '@/data/faq';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useT } from '@/i18n';
import { cn } from '@/utils/cn';

export default function FaqPage() {
  const { t, lang } = useT();
  const groups = useMemo(() => getFaqGroups(), [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(groups[0].id);

  usePageMeta({
    title: t('pages.faq.metaTitle'),
    description: t('pages.faq.metaDescription'),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: groups.flatMap((g) => g.items).map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.answer } })),
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => `${i.question} ${i.answer}`.toLocaleLowerCase().includes(q)) }))
      .filter((g) => g.items.length);
  }, [query, groups]);

  return (
    <>
      <PageHero eyebrow={t('pages.faq.hero.eyebrow')} title={t('pages.faq.hero.title')} crumbs={[{ label: t('pages.faq.crumb') }]} />
      <div className="container-site grid grid-cols-1 gap-10 pb-24 lg:grid-cols-[240px_1fr] lg:gap-16">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="relative">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
            <label htmlFor="faq-search" className="sr-only">
              {t('pages.faq.search')}
            </label>
            <input id="faq-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('pages.faq.search')} className="input ps-11" />
          </div>
          <nav aria-label={t('pages.faq.topics')} className="mt-6 hidden lg:block">
            <ul className="space-y-0.5">
              {groups.map((g) => (
                <li key={g.id}>
                  <a
                    href={`#${g.id}`}
                    onClick={() => setActive(g.id)}
                    className={cn('flex min-h-[40px] items-center border-s-2 px-4 text-sm transition-colors', active === g.id ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-500 hover:text-ink')}
                  >
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0">
          {filtered.length === 0 ? (
            <p className="py-10 text-ink-500">
              {t('pages.faq.noResultsBefore', { query: query.trim() })}{' '}
              <Link to="/contact" className="font-semibold text-ink underline">
                {t('pages.faq.noResultsLink')}
              </Link>
              {t('pages.faq.noResultsAfter')}
            </p>
          ) : (
            <div className="space-y-14">
              {filtered.map((g) => (
                <section key={g.id} id={g.id} className="scroll-mt-28" aria-labelledby={`${g.id}-title`}>
                  <h2 id={`${g.id}-title`} className="heading-md mb-2">
                    {g.title}
                  </h2>
                  <div className="border-t border-paper-200">
                    {g.items.map((i) => (
                      <AccordionItem key={i.question} title={i.question} defaultOpen={Boolean(query)}>
                        <p>{i.answer}</p>
                      </AccordionItem>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <div className="mt-16 flex flex-col gap-4 bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <p className="font-display text-3xl font-bold uppercase">{t('pages.faq.help.title')}</p>
              <p className="mt-1 text-white/70">{t('pages.faq.help.body')}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/contact" className="btn btn-light">
                {t('pages.faq.help.contact')}
              </Link>
              <a href={SITE.contact.phoneHref} className="btn btn-outline-light" aria-label={`${t('pages.faq.help.call')} ${SITE.contact.phone}`}>
                <Phone className="h-4 w-4" aria-hidden /> {t('pages.faq.help.call')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
