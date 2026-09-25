import { Search as SearchIcon } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Breadcrumbs, EmptyState } from '@/components/common';
import { CatalogView } from '@/components/product/CatalogView';
import { searchPath } from '@/constants/routes';
import { FEATURED_CATEGORIES } from '@/data/categories';
import { POPULAR_SEARCHES } from '@/data/navigation';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useSearchHistoryStore } from '@/store/historyStores';
import { pluralize } from '@/utils/format';

export default function SearchPage() {
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

  usePageMeta({ title: q ? `Search: ${q}` : 'Search', description: `Search results for ${q} at SPORTX.`, noindex: true });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) navigate(searchPath(input.trim()));
  };

  const noResults = (
    <EmptyState
      icon={<SearchIcon />}
      title={`No results for “${q}”`}
      description={
        <>
          <p>Check your spelling, use fewer words or try one of these popular searches.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {POPULAR_SEARCHES.map((p) => (
              <Link key={p} to={searchPath(p)} className="min-h-[40px] rounded-full border border-paper-300 px-4 py-2 text-sm text-ink hover:border-ink">
                {p}
              </Link>
            ))}
          </div>
        </>
      }
      action={
        <div className="mt-2 grid w-full max-w-2xl grid-cols-3 gap-3 sm:grid-cols-6">
          {FEATURED_CATEGORIES.map((c) => (
            <Link key={c.slug} to={c.href} className="border border-paper-200 px-2 py-3 text-xs font-semibold uppercase tracking-[0.1em] hover:border-ink">
              {c.name}
            </Link>
          ))}
        </div>
      }
    />
  );

  return (
    <div className="container-site pb-24 pt-8 sm:pt-10">
      <Breadcrumbs items={[{ label: 'Search' }]} />
      <form onSubmit={submit} role="search" className="mt-8 flex items-center gap-3 border-b-2 border-ink pb-3">
        <SearchIcon className="h-6 w-6 shrink-0" aria-hidden />
        <label htmlFor="search-page-input" className="sr-only">
          Search products
        </label>
        <input
          id="search-page-input"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search SPORTX"
          className="min-w-0 flex-1 bg-transparent font-display text-3xl font-bold uppercase tracking-tight placeholder:text-ink/20 focus:outline-none sm:text-5xl"
        />
        <button type="submit" className="btn btn-primary btn-sm hidden sm:inline-flex">
          Search
        </button>
      </form>

      {q ? (
        <>
          <h1 className="mt-6 text-sm text-ink-500" aria-live="polite">
            {total === null ? 'Searching…' : `${pluralize(total, 'result')} for `}
            {total !== null && <span className="font-semibold text-ink">“{q}”</span>}
          </h1>
          <div className="mt-8">
            <CatalogView key={q} base={{ q }} emptyState={noResults} onTotal={onTotal} />
          </div>
        </>
      ) : (
        <div className="py-16">
          <h1 className="heading-md">What are you looking for?</h1>
          <p className="mt-3 text-ink-500">Popular right now:</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {POPULAR_SEARCHES.map((p) => (
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
