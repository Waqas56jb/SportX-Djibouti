import { useRef, useState } from 'react';
import type { Paginated } from '@/types';
import type { SortState } from '@/components/tables';
import { useAsync } from '@/hooks/useAsync';

export interface ServerListQuery {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/**
 * Server-paginated list state for DataTable: page, page size and sort live here; the page
 * resets to 1 whenever `filterDeps` change. Spread `table` onto <DataTable>.
 * Used by the Customers, Customer groups, Reviews and Support lists.
 */
export function useServerList<R extends Paginated<unknown>>(loader: (q: ServerListQuery) => Promise<R>, filterDeps: unknown[], { initialSort, initialPageSize = 25 }: { initialSort?: SortState; initialPageSize?: number } = {}) {
  const key = JSON.stringify(filterDeps);
  const [pg, setPg] = useState({ key, page: 1 });
  const page = pg.key === key ? pg.page : 1;
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sort, setSort] = useState<SortState | undefined>(initialSort);

  const state = useAsync(() => loader({ page, pageSize, sortBy: sort?.id, sortDir: sort?.dir }), [key, page, pageSize, sort?.id, sort?.dir]);

  // Keep the last known total while a new page loads so the pager doesn't jump.
  const lastTotal = useRef(0);
  if (state.data) lastTotal.current = state.data.total;

  return {
    ...state,
    page,
    table: {
      sort,
      onSortChange: (s: SortState) => {
        setSort(s);
        setPg({ key, page: 1 });
      },
      serverPagination: {
        page,
        pageSize,
        total: state.data?.total ?? lastTotal.current,
        onPageChange: (p: number) => setPg({ key, page: p }),
        onPageSizeChange: (s: number) => {
          setPageSize(s);
          setPg({ key, page: 1 });
        },
      },
    },
  };
}
