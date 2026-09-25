import { ArrowRight, Clock, Search, TrendingUp, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Price, SmartImage, Spinner } from '@/components/common';
import { productPath, searchPath } from '@/constants/routes';
import { IMG, type ImageKey } from '@/data/images';
import { getPopularSearches } from '@/data/navigation';
import { useSearch } from '@/hooks/useSearch';
import { categoryLabel } from '@/services/productService';
import { useEscape, useFocusTrap, useLockBodyScroll } from '@/hooks/useUi';
import { useUiStore } from '@/store/uiStore';
import { t } from '@/i18n';

/** Expanded header search with recent, popular and instant results. */
export function SearchOverlay() {
  const open = useUiStore((s) => s.overlay === 'search');
  const close = useUiStore((s) => s.close);
  const [term, setTerm] = useState('');
  const { results, loading, recent, remember, forget, clearRecent, query } = useSearch(term);
  const navigate = useNavigate();
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useLockBodyScroll(open);
  useEscape(open, close);
  useFocusTrap(panel, open);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 30);
    else setTerm('');
  }, [open]);

  const submit = (value: string) => {
    const q = value.trim();
    if (!q) return;
    remember(q);
    close();
    navigate(searchPath(q));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(term);
  };

  if (!open) return null;

  const showResults = query.length >= 2;

  return createPortal(
    <div className="fixed inset-0 z-[75]">
      <div className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-[2px]" onClick={close} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={t('catalog.overlay.dialog')} className="relative max-h-[100dvh] animate-slide-down overflow-y-auto bg-white shadow-lift">
        <div className="container-site">
          <form onSubmit={onSubmit} role="search" className="flex h-20 items-center gap-3 border-b border-ink sm:h-24">
            <Search className="h-6 w-6 shrink-0 text-ink" aria-hidden />
            <label htmlFor="site-search" className="sr-only">
              {t('catalog.overlay.label')}
            </label>
            <input
              ref={input}
              id="site-search"
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t('catalog.overlay.placeholder')}
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent font-display text-2xl font-semibold uppercase tracking-tight placeholder:text-ink/25 focus:outline-none sm:text-4xl"
              aria-controls="search-results"
            />
            {loading && <Spinner className="h-5 w-5 text-ink-500" label={t('catalog.overlay.searching')} />}
            {term && (
              <button type="button" onClick={() => setTerm('')} className="hidden text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 hover:text-ink sm:block">
                {t('common.actions.clear')}
              </button>
            )}
            <button type="button" onClick={close} className="icon-btn" aria-label={t('catalog.overlay.close')}>
              <X className="h-6 w-6" />
            </button>
          </form>

          <div id="search-results" className="grid gap-10 py-8 md:grid-cols-[240px_1fr] md:py-10" aria-live="polite">
            <div className="space-y-8">
              {recent.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="eyebrow">{t('catalog.overlay.recent')}</p>
                    <button type="button" onClick={clearRecent} className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-500 hover:text-ink">
                      {t('common.actions.clear')}
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {recent.map((r) => (
                      <li key={r} className="group flex min-w-0 items-center justify-between gap-2">
                        <button type="button" onClick={() => submit(r)} className="flex min-h-[40px] min-w-0 items-center gap-3 text-start text-[15px] text-ink-700 hover:text-ink">
                          <Clock className="h-4 w-4 shrink-0 text-ink-500" aria-hidden /> <span className="truncate">{r}</span>
                        </button>
                        <button type="button" onClick={() => forget(r)} className="p-2 text-ink-500 opacity-60 hover:text-ink group-hover:opacity-100" aria-label={t('catalog.overlay.removeRecent', { term: r })}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="eyebrow mb-3">{t('catalog.overlay.popular')}</p>
                <ul className="flex flex-wrap gap-2 md:flex-col md:gap-1">
                  {getPopularSearches().map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => submit(p)}
                        className="flex min-h-[40px] items-center gap-3 border border-paper-300 px-3 text-sm text-ink-700 hover:border-ink hover:text-ink md:border-0 md:px-0 md:text-[15px]"
                      >
                        <TrendingUp className="hidden h-4 w-4 text-ink-500 md:block" aria-hidden /> {p}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              {showResults ? (
                results.length > 0 ? (
                  <>
                    <p className="eyebrow mb-4">{t('catalog.overlay.products')}</p>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
                      {results.map((p) => (
                        <li key={p.id}>
                          <Link to={productPath(p.slug)} onClick={() => { remember(term); close(); }} className="group block">
                            <div className="relative aspect-[4/5] overflow-hidden bg-paper-100">
                              <SmartImage src={p.images[0]?.url ?? ''} alt={p.images[0]?.alt ?? p.name} sizes="200px" maxWidth={480} wrapperClassName="absolute inset-0" className="transition-transform duration-500 group-hover:scale-105" />
                            </div>
                            <p className="mt-2 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-500">{categoryLabel(p)}</p>
                            <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                            <Price price={p.price} compareAtPrice={p.compareAtPrice} size="sm" className="mt-1" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={() => submit(term)} className="group mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                      <span className="link-underline">{t('catalog.overlay.viewAll', { q: query })}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" aria-hidden />
                    </button>
                  </>
                ) : (
                  !loading && (
                    <div className="py-6">
                      <p className="heading-md break-words">{t('catalog.overlay.noResults', { q: query })}</p>
                      <p className="mt-2 text-sm text-ink-500">{t('catalog.overlay.noResultsHint')}</p>
                    </div>
                  )
                )
              ) : (
                <div className="hidden md:block">
                  <p className="eyebrow mb-4">{t('catalog.overlay.trending')}</p>
                  <div className="grid grid-cols-3 gap-4">
                    {TRENDING.map((tile) => (
                      <TrendingTile key={tile.slug} label={t(`common.category.${tile.slug}`)} to={`/categories/${tile.slug}`} img={tile.img} onNavigate={close} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}


const TRENDING: { slug: 'football-boots' | 'team-kits' | 'polo-shirts'; img: ImageKey }[] = [
  { slug: 'football-boots', img: 'bootsOrangeCorner' },
  { slug: 'team-kits', img: 'teamWalkout' },
  { slug: 'polo-shirts', img: 'poloCoach' },
];

function TrendingTile({ label, to, img, onNavigate }: { label: string; to: string; img: ImageKey; onNavigate: () => void }) {
  return (
    <Link to={to} onClick={onNavigate} className="group relative block aspect-[16/10] overflow-hidden">
      <SmartImage src={IMG[img]} alt="" sizes="25vw" maxWidth={800} wrapperClassName="absolute inset-0" className="transition-transform duration-700 ease-premium group-hover:scale-105" />
      <span className="absolute inset-0 bg-gradient-to-t from-ink/75 to-transparent" />
      <span className="absolute bottom-3 start-3 end-3 font-display text-xl font-bold uppercase text-white">{label}</span>
    </Link>
  );
}
