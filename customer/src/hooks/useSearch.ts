import { productService } from '@/services';
import { useSearchHistoryStore } from '@/store/historyStores';
import { useAsync } from './useAsync';
import { useDebounce } from './useDebounce';

/** Debounced instant search for the header overlay. */
export function useSearch(term: string, limit = 6) {
  const debounced = useDebounce(term.trim(), 220);
  const results = useAsync(() => productService.search(debounced, limit), [debounced, limit], {
    enabled: debounced.length >= 2,
    keepPrevious: true,
  });
  const history = useSearchHistoryStore();

  return {
    query: debounced,
    results: debounced.length >= 2 ? (results.data ?? []) : [],
    loading: results.loading || (term.trim() !== debounced && term.trim().length >= 2),
    error: results.error,
    recent: history.terms,
    remember: history.add,
    forget: history.remove,
    clearRecent: history.clear,
  };
}
