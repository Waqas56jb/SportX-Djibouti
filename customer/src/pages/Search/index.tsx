import { Search as SearchIcon } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Breadcrumbs, EmptyState } from '@/components/common';
import { CatalogView } from '@/components/product/CatalogView';
import { searchPath } from '@/constants/routes';
import { getFeaturedCategories } from '@/data/categories';
import { getPopularSearches } from '@/data/navigation';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useSearchHistoryStore } from '@/store/historyStores';
import { useT } from '@/i18n';

export default function SearchPage() {
  const { t } = useT();
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const [input, setInput] = useState(q);
  const [total, setTotal] = useState<number | null>(null);
  const navigate = useNavigate();
  const remember = useSearchHistoryStore((s) => s.add);
  const onTotal = useCallback((n: number) => setTotal(n), []);

  useEffect(() => {
    setInput(q);
    setTotal(null);
    if (q) remember(q);
  }, [q, remember]);

  usePageMeta({ title: q ? t('catalog.search.metaTitle', { q }) : t('catalog.search.metaTitleEmpty'), description: t('catalog.search.metaDescription', { q }), noindex: true });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) navigate(searchPath(input.trim()));
  };

  const noResults = (
    <EmptyState
      icon={<SearchIcon />}
      title={t('catalog.search.noResults', { q })}
      description={
        <>
          <p>{t('catalog.search.noResultsHint')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {getPopularSearches().map((p) => (
              <Link key={p} to={searchPath(p)} className="min-h-[40px] rounded-full border border-paper-300 px-4 py-2 text-sm text-ink hover:border-ink">
                {p}
              </Link>
            ))}
          </div>
        </>
      }
      action={
        <div className="mt-2 grid w-full max-w-2xl grid-cols-2 gap-2 xs:grid-cols-3 sm:gap-3 md:grid-cols-6">
          {getFeaturedCategories().map((c) => (
            <Link key={c.slug} to={c.href} className="flex min-h-[44px] items-center justify-center border border-paper-200 px-2 py-3 text-center text-xs font-semibold uppercase leading-tight tracking-[0.1em] hover:border-ink">
              {c.name}
            </Link>
          ))}
        </div>
      }
    />
  );

  return (
    <div className="container-site pb-24 pt-8 sm:pt-10">
      <Breadcrumbs items={[{ label: t('catalog.crumbs.search') }]} />
      <form onSubmit={submit} role="search" className="mt-8 flex items-center gap-3 border-b-2 border-ink pb-3">
        <SearchIcon className="h-6 w-6 shrink-0" aria-hidden />
        <label htmlFor="search-page-input" className="sr-only">
          {t('catalog.search.label')}
        </label>
        <input
          id="search-page-input"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('catalog.search.placeholder')}
          className="min-w-0 flex-1 bg-transparent font-display text-3xl font-bold uppercase tracking-tight placeholder:text-ink/20 focus:outline-none sm:text-5xl"
        />
        <button type="submit" className="btn btn-primary btn-sm hidden sm:inline-flex">
          {t('common.actions.search')}
        </button>
      </form>

      {q ? (
        <>
          <h1 className="mt-6 text-sm text-ink-500" aria-live="polite">
            {total === null ? t('catalog.search.searching') : `${t('catalog.search.resultsFor', { count: total })} `}
            {total !== null && <span className="break-words font-semibold text-ink">“{q}”</span>}
          </h1>
          <div className="mt-8">
            <CatalogView key={q} base={{ q }} emptyState={noResults} onTotal={onTotal} />
          </div>
        </>
      ) : (
        <div className="py-16">
          <h1 className="heading-md">{t('catalog.search.prompt')}</h1>
          <p className="mt-3 text-ink-500">{t('catalog.search.popularNow')}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {getPopularSearches().map((p) => (
              <Link key={p} to={searchPath(p)} className="min-h-[40px] rounded-full border border-paper-300 px-4 py-2 text-sm hover:border-ink">
                {p}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
