import { Phone, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccordionItem } from '@/components/common';
import { PageHero } from '@/components/marketing/PageHero';
import { SITE } from '@/constants/site';
import { FAQ_GROUPS } from '@/data/faq';
import { usePageMeta } from '@/hooks/usePageMeta';
import { cn } from '@/utils/cn';

export default function FaqPage() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(FAQ_GROUPS[0].id);

  usePageMeta({
    title: 'FAQ',
    description: 'Answers to common questions about SPORTX orders, shipping, returns, payments, sizing and your account.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_GROUPS.flatMap((g) => g.items).map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.answer } })),
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ_GROUPS;
    return FAQ_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => `${i.question} ${i.answer}`.toLowerCase().includes(q)) })).filter((g) => g.items.length);
  }, [query]);

  return (
    <>
      <PageHero eyebrow="Help centre" title="Frequently asked questions" crumbs={[{ label: 'FAQ' }]} />
      <div className="container-site grid grid-cols-1 gap-10 pb-24 lg:grid-cols-[240px_1fr] lg:gap-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
            <label htmlFor="faq-search" className="sr-only">
              Search questions
            </label>
            <input id="faq-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions" className="input pl-11" />
          </div>
          <nav aria-label="FAQ topics" className="mt-6 hidden lg:block">
            <ul className="space-y-0.5">
              {FAQ_GROUPS.map((g) => (
                <li key={g.id}>
                  <a
                    href={`#${g.id}`}
                    onClick={() => setActive(g.id)}
                    className={cn('flex min-h-[40px] items-center border-l-2 px-4 text-sm transition-colors', active === g.id ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-500 hover:text-ink')}
                  >
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div>
          {filtered.length === 0 ? (
            <p className="py-10 text-ink-500">
              No questions match “{query}”. Try another word or{' '}
              <Link to="/contact" className="font-semibold text-ink underline">
                contact us
              </Link>
              .
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

          <div className="mt-16 flex flex-col gap-4 bg-ink p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <p className="font-display text-3xl font-bold uppercase">Still need help?</p>
              <p className="mt-1 text-white/70">Our team is ready to help with orders, sizing and more.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/contact" className="btn btn-light">
                Contact us
              </Link>
              <a href={SITE.contact.phoneHref} className="btn btn-outline-light">
                <Phone className="h-4 w-4" aria-hidden /> Call
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
