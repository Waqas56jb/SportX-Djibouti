import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useIsMobile } from '@/hooks/misc';
import { useUiStore } from '@/store/uiStore';
import { Checkbox } from '@/components/forms/Choice';
import { EmptyState, ErrorState, Skeleton } from '@/components/common/States';
import { Menu } from '@/components/common/Menu';
import { Pagination } from './Pagination';

export interface Column<T> {
  id: string;
  header: ReactNode;
  /** Plain-text label for the column menu and mobile cards when `header` is a node. */
  label?: string;
  cell: (row: T) => ReactNode;
  /** Providing a sort value makes the column sortable. */
  sortValue?: (row: T) => string | number | undefined | null;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
  /** Can the user hide this column? Default true. */
  hideable?: boolean;
  defaultHidden?: boolean;
  /** How the column renders in mobile card view. Default 'meta'. */
  mobile?: 'title' | 'subtitle' | 'meta' | 'aside' | 'hidden';
}

export interface SortState {
  id: string;
  dir: 'asc' | 'desc';
}

export interface DataTableProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  getRowId: (row: T) => string;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  /** Rendered when there are no rows. Defaults to a generic empty state. */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  /** Bulk action bar content, shown when rows are selected. */
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode;
  toolbar?: ReactNode;
  toolbarRight?: ReactNode;
  pageSize?: number;
  initialSort?: SortState;
  /** Controlled sort — when set, the table does not sort internally (server-side sorting). */
  sort?: SortState;
  onSortChange?: (s: SortState) => void;
  rowActions?: (row: T) => ReactNode;
  /** Persist hidden columns under this key. */
  storageKey?: string;
  caption: string;
  className?: string;
  /** Visually highlight a row (e.g. unread). */
  rowClassName?: (row: T) => string | undefined;
  footer?: ReactNode;
  hidePagination?: boolean;
  /**
   * Server-side pagination: `data` is already the current page. The table renders the given
   * totals and reports page changes instead of slicing locally. Combine with controlled `sort`
   * + `onSortChange` for server-side sorting.
   */
  serverPagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
  };
}

function readHidden(key: string | undefined, cols: Column<unknown>[]): string[] {
  const def = cols.filter((c) => c.defaultHidden).map((c) => c.id);
  if (!key) return def;
  try {
    const raw = localStorage.getItem(`sportx-cols-${key}`);
    return raw ? (JSON.parse(raw) as string[]) : def;
  } catch {
    return def;
  }
}

function compare(a: unknown, b: unknown) {
  if (a === b) return 0;
  if (a === undefined || a === null || a === '') return 1;
  if (b === undefined || b === null || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * The single table implementation used across the admin: sorting, pagination, column
 * visibility, row selection with bulk actions, loading skeletons, empty and error states,
 * and a card layout on small screens.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const { data, columns, getRowId, loading, error, onRetry, empty, onRowClick, selectable, bulkActions, toolbar, toolbarRight, pageSize: initialPageSize = 10, initialSort, rowActions, storageKey, caption, className, rowClassName, footer, hidePagination, serverPagination: sp } = props;
  const isMobile = useIsMobile();
  const density = useUiStore((s) => s.tableDensity);
  const [internalSort, setInternalSort] = useState<SortState | undefined>(initialSort);
  const sort = props.sort ?? internalSort;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<string[]>(() => readHidden(storageKey, columns as Column<unknown>[]));

  const visibleCols = columns.filter((c) => !hidden.includes(c.id));

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(`sportx-cols-${storageKey}`, JSON.stringify(hidden));
    } catch {
      /* ignore */
    }
  }, [hidden, storageKey]);

  const sorted = useMemo(() => {
    const rows = data ?? [];
    if (!sort || props.sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const out = [...rows].sort((a, b) => compare(col.sortValue!(a), col.sortValue!(b)));
    return sort.dir === 'desc' ? out.reverse() : out;
  }, [data, sort, columns, props.sort]);

  const total = sp ? sp.total : sorted.length;
  const effPageSize = sp ? sp.pageSize : pageSize;
  const effPage = sp ? sp.page : page;
  const pageCount = Math.max(1, Math.ceil(total / effPageSize));
  useEffect(() => {
    if (!sp && page > pageCount) setPage(pageCount);
  }, [page, pageCount, sp]);
  // Reset to first page when the dataset changes shape (new filters).
  useEffect(() => {
    if (!sp) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.length]);
  // Drop selections that no longer exist.
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.map(getRowId));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const rows = hidePagination || sp ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize);
  const pageIds = rows.map(getRowId);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));
  const clear = () => setSelected(new Set());

  const toggleSort = (c: Column<T>) => {
    if (!c.sortValue) return;
    const next: SortState = sort?.id === c.id ? { id: c.id, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { id: c.id, dir: typeof c.sortValue(sorted[0] ?? ({} as T)) === 'number' ? 'desc' : 'asc' };
    if (props.onSortChange) props.onSortChange(next);
    if (!props.sort) setInternalSort(next);
  };

  const toggleRow = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const hideableCols = columns.filter((c) => c.hideable !== false);
  const cellPad = density === 'compact' ? 'py-2' : 'py-3';

  const showToolbar = toolbar || toolbarRight || hideableCols.length > 0;

  return (
    <div className={cn('panel overflow-hidden', className)}>
      {showToolbar && (
        <div className="flex flex-col gap-2 border-b border-zinc-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          <div className="flex shrink-0 items-center gap-2">
            {toolbarRight}
            {!isMobile && hideableCols.length > 2 && (
              <Menu
                label="Columns"
                width={220}
                header={<div className="px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wider text-zinc-400">Visible columns</div>}
                trigger={(p) => (
                  <button type="button" {...p} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[0.8125rem] font-medium text-zinc-700 shadow-sm hover:border-zinc-300">
                    <Columns3 size={14} aria-hidden /> Columns
                  </button>
                )}
                items={hideableCols.map((c) => ({
                  label: `${hidden.includes(c.id) ? '○' : '●'}  ${c.label ?? (typeof c.header === 'string' ? c.header : c.id)}`,
                  onSelect: () => setHidden((h) => (h.includes(c.id) ? h.filter((x) => x !== c.id) : [...h, c.id])),
                }))}
              />
            )}
          </div>
        </div>
      )}

      {selectable && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 bg-ink-950 px-4 py-2.5 text-white">
          <span className="text-[0.8125rem] font-medium tabular">
            <span className="mr-1 inline-flex h-5 min-w-5 items-center justify-center rounded bg-volt px-1 text-xs font-bold text-ink-950">{selected.size}</span> selected
          </span>
          {selected.size < sorted.length && (
            <button type="button" onClick={() => setSelected(new Set(sorted.map(getRowId)))} className="text-xs font-medium text-zinc-400 underline-offset-2 hover:text-white hover:underline">
              Select all {sorted.length}{sp && total > sorted.length ? ' on this page' : ''}
            </button>
          )}
          <div className="dark-surface flex flex-1 flex-wrap items-center gap-1.5 [&_button]:text-zinc-200">{bulkActions?.([...selected], clear)}</div>
          <button type="button" onClick={clear} aria-label="Clear selection" className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {error ? (
        <ErrorState onRetry={onRetry} description="We couldn’t load this list. Please try again." />
      ) : isMobile ? (
        <MobileList {...{ rows, loading, columns: visibleCols, getRowId, onRowClick, selectable, selected, toggleRow, rowActions, empty, rowClassName }} />
      ) : (
        <div className="relative overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/70">
                {selectable && (
                  <th scope="col" className="w-10 py-2.5 pl-4 pr-1">
                    <Checkbox
                      ariaLabel="Select all rows on this page"
                      checked={allPageSelected}
                      indeterminate={somePageSelected}
                      onChange={(on) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          pageIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
                          return next;
                        })
                      }
                    />
                  </th>
                )}
                {visibleCols.map((c) => {
                  const active = sort?.id === c.id;
                  return (
                    <th
                      key={c.id}
                      scope="col"
                      aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn('whitespace-nowrap px-3 py-2.5 text-2xs font-semibold uppercase tracking-[0.08em] text-zinc-500 first:pl-4', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.headerClassName)}
                    >
                      {c.sortValue ? (
                        <button type="button" onClick={() => toggleSort(c)} className={cn('group inline-flex items-center gap-1 uppercase hover:text-zinc-900', active && 'text-zinc-900', c.align === 'right' && 'flex-row-reverse')}>
                          {c.header}
                          {active ? sort!.dir === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden /> : <ChevronsUpDown size={12} className="opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
                {rowActions && (
                  <th scope="col" className="relative w-12 py-2.5 pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0">
                      {selectable && (
                        <td className="py-3.5 pl-4 pr-1">
                          <Skeleton className="h-4 w-4" />
                        </td>
                      )}
                      {visibleCols.map((c, ci) => (
                        <td key={c.id} className="px-3 py-3.5 first:pl-4">
                          <Skeleton className={cn('h-3.5', ci === 0 ? 'w-40' : 'w-16', c.align === 'right' && 'ml-auto')} />
                        </td>
                      ))}
                      {rowActions && <td />}
                    </tr>
                  ))
                : rows.map((row) => {
                    const id = getRowId(row);
                    const isSel = selected.has(id);
                    return (
                      <tr
                        key={id}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        onKeyDown={onRowClick ? (e) => e.key === 'Enter' && e.target === e.currentTarget && onRowClick(row) : undefined}
                        tabIndex={onRowClick ? 0 : undefined}
                        className={cn('group border-b border-zinc-100 transition-colors last:border-0', onRowClick && 'cursor-pointer', isSel ? 'bg-volt/[0.08]' : 'hover:bg-zinc-50/80', rowClassName?.(row))}
                      >
                        {selectable && (
                          <td className={cn('pl-4 pr-1', cellPad)} onClick={(e) => e.stopPropagation()}>
                            <Checkbox ariaLabel="Select row" checked={isSel} onChange={(on) => toggleRow(id, on)} />
                          </td>
                        )}
                        {visibleCols.map((c) => (
                          <td key={c.id} className={cn('px-3 align-middle text-[0.8125rem] text-zinc-700 first:pl-4', cellPad, c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>
                            {c.cell(row)}
                          </td>
                        ))}
                        {rowActions && (
                          <td className={cn('pr-3 text-right', cellPad)} onClick={(e) => e.stopPropagation()}>
                            {rowActions(row)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {!loading && total === 0 && (empty ?? <EmptyState title="No results found" description="Try adjusting your search or filters." />)}
        </div>
      )}

      {!error && !loading && total > 0 && !hidePagination && (
        <Pagination
          page={effPage}
          pageCount={pageCount}
          pageSize={effPageSize}
          total={total}
          onPageChange={sp ? sp.onPageChange : setPage}
          onPageSizeChange={
            sp
              ? sp.onPageSizeChange
              : (s) => {
                  setPageSize(s);
                  setPage(1);
                }
          }
        />
      )}
      {footer}
    </div>
  );
}

interface MobileListProps<T> {
  rows: T[];
  loading?: boolean;
  columns: Column<T>[];
  getRowId: (r: T) => string;
  onRowClick?: (r: T) => void;
  selectable?: boolean;
  selected: Set<string>;
  toggleRow: (id: string, on: boolean) => void;
  rowActions?: (r: T) => ReactNode;
  empty?: ReactNode;
  rowClassName?: (r: T) => string | undefined;
}

/** Card layout for phones — avoids forcing wide tables to scroll horizontally. */
function MobileList<T>({ rows, loading, columns, getRowId, onRowClick, selectable, selected, toggleRow, rowActions, empty, rowClassName }: MobileListProps<T>) {
  if (loading)
    return (
      <ul className="divide-y divide-zinc-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="space-y-2 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
    );
  if (rows.length === 0) return <>{empty ?? <EmptyState title="No results found" description="Try adjusting your search or filters." />}</>;
  const title = columns.find((c) => c.mobile === 'title') ?? columns[0];
  const subtitle = columns.filter((c) => c.mobile === 'subtitle');
  const aside = columns.filter((c) => c.mobile === 'aside');
  const meta = columns.filter((c) => c !== title && (c.mobile ?? 'meta') === 'meta');
  return (
    <ul className="divide-y divide-zinc-100">
      {rows.map((row) => {
        const id = getRowId(row);
        return (
          <li key={id} className={cn('flex gap-3 p-4', selected.has(id) && 'bg-volt/[0.08]', rowClassName?.(row))}>
            {selectable && (
              <div className="pt-0.5">
                <Checkbox ariaLabel="Select row" checked={selected.has(id)} onChange={(on) => toggleRow(id, on)} />
              </div>
            )}
            <div
              className={cn('min-w-0 flex-1', onRowClick && 'cursor-pointer')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm font-medium text-zinc-900">{title.cell(row)}</div>
                {aside.length > 0 && <div className="flex shrink-0 flex-col items-end gap-1 text-sm">{aside.map((c) => <div key={c.id}>{c.cell(row)}</div>)}</div>}
              </div>
              {subtitle.map((c) => (
                <div key={c.id} className="mt-0.5 text-xs text-zinc-500">
                  {c.cell(row)}
                </div>
              ))}
              {meta.length > 0 && (
                <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {meta.map((c) => (
                    <div key={c.id} className="min-w-0">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{c.label ?? (typeof c.header === 'string' ? c.header : c.id)}</dt>
                      <dd className="truncate text-xs text-zinc-700">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            {rowActions && <div className="shrink-0">{rowActions(row)}</div>}
          </li>
        );
      })}
    </ul>
  );
}
