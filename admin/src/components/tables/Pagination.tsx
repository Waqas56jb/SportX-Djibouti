import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

function pages(current: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < count - 1) out.push('…');
  out.push(count);
  return out;
}

export function Pagination({ page, pageCount, pageSize, total, onPageChange, onPageSizeChange, sizes = [10, 25, 50] }: { page: number; pageCount: number; pageSize: number; total: number; onPageChange: (p: number) => void; onPageSizeChange?: (s: number) => void; sizes?: number[] }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 border-t border-zinc-100 px-4 py-3 text-[0.8125rem] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="tabular">
          <span className="font-medium text-zinc-800">
            {from}–{to}
          </span>{' '}
          of <span className="font-medium text-zinc-800">{total}</span>
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            <span className="hidden sm:inline">Rows</span>
            <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} className="h-7 rounded-md border border-zinc-200 bg-white px-1.5 text-xs font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10" aria-label="Rows per page">
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 disabled:opacity-30">
          <ChevronLeft size={16} />
        </button>
        {pages(page, pageCount).map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1 text-zinc-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn('inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-medium tabular', p === page ? 'bg-ink-950 text-white' : 'text-zinc-600 hover:bg-zinc-100')}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
