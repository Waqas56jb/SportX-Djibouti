import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, EyeOff, MessageSquareText, Trash2, X } from 'lucide-react';
import type { Review, ReviewStatus } from '@/types';
import { Button, EmptyState, PageHeader, Tabs } from '@/components/common';
import { FilterSelect, SearchInput } from '@/components/forms';
import { BulkButton, ClearFiltersButton, DataTable } from '@/components/tables';
import { useServerList } from '@/components/customers/useServerList';
import { ReviewDetailDrawer } from '@/components/reviews/ReviewDetailDrawer';
import { ReviewRowMenu, reviewColumns } from '@/components/reviews/reviewColumns';
import { useReviewModeration } from '@/components/reviews/useReviewModeration';
import { REVIEW_STATUS } from '@/constants/status';
import { reviewService } from '@/services/reviewService';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/misc';
import { usePermission } from '@/hooks/usePermission';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { cn } from '@/utils/cn';

type TabValue = 'all' | ReviewStatus;
const STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected', 'hidden'];
const RATING_OPTIONS = [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? '' : 's'}` }));

export default function ReviewsPage() {
  const [, setParams] = useSearchParams();
  const { filters, setFilter, activeCount } = useUrlFilters({ status: '', rating: '', product: '', from: '', search: '' });
  const search = useDebounce(filters.search, 250);
  const canModerate = usePermission('reviews:approve');
  const canDelete = usePermission('reviews:delete');
  const { setStatus, remove, busy } = useReviewModeration();
  const [openId, setOpenId] = useState<string | null>(null);

  // Status filter, search, sort and pagination are server-side; the per-status counts
  // returned alongside ignore the status filter so every tab shows its total.
  const tab: TabValue = STATUSES.includes(filters.status as ReviewStatus) ? (filters.status as ReviewStatus) : 'all';
  const list = useServerList(
    (q) =>
      reviewService.getReviews({
        ...q,
        search,
        filters: { status: tab === 'all' ? '' : tab, rating: filters.rating ? Number(filters.rating) : '', productId: filters.product || undefined, from: filters.from || undefined },
      }),
    [search, tab, filters.rating, filters.product, filters.from],
    { initialSort: { id: 'date', dir: 'desc' } },
  );
  const { loading, error, reload } = list;
  const rows = list.data?.data;
  const counts = list.data?.counts;

  const products = useAsync(() => reviewService.getProductOptions(), []);
  const open = rows?.find((r) => r.id === openId) ?? null;

  const act = async (ids: string[], status: ReviewStatus, clear?: () => void) => {
    if (await setStatus(ids, status)) {
      clear?.();
      await reload(true);
    }
  };
  const del = async (ids: string[], clear?: () => void) => {
    if (await remove(ids)) {
      clear?.();
      if (openId && ids.includes(openId)) setOpenId(null);
      await reload(true);
    }
  };

  const filterCount = activeCount - (filters.status ? 1 : 0);
  // Clears every filter except the active status tab.
  const clearFilters = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ['rating', 'product', 'from', 'search'].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true },
    );

  const emptyState =
    tab === 'pending' && !filterCount && !filters.search ? (
      <EmptyState icon={Check} title="No reviews pending." description="You’re all caught up. New reviews will appear here for moderation." />
    ) : (
      <EmptyState
        icon={MessageSquareText}
        title="No reviews found."
        description="No review matches the current filters."
        action={
          filterCount || filters.search ? (
            <Button size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );

  return (
    <div>
      <PageHeader title="Reviews" description="Moderate customer reviews before they appear on the storefront." />

      <Tabs<TabValue>
        ariaLabel="Review status"
        className="mb-4"
        value={tab}
        onChange={(v) => setFilter('status', v === 'all' ? '' : v)}
        items={[
          { value: 'all', label: 'All', count: counts?.all },
          ...STATUSES.map((s) => ({
            value: s,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {s === 'pending' && (counts?.pending ?? 0) > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
                {REVIEW_STATUS[s].label}
              </span>
            ),
            count: counts?.[s],
          })),
        ]}
      />

      <DataTable
        caption="Product reviews"
        storageKey="reviews"
        data={rows}
        columns={reviewColumns}
        getRowId={(r: Review) => r.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        {...list.table}
        onRowClick={(r) => setOpenId(r.id)}
        rowClassName={(r) => (r.status === 'pending' ? 'bg-amber-50/30' : undefined)}
        selectable={canModerate || canDelete}
        empty={emptyState}
        toolbar={
          <>
            <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search reviews, products, customers…" label="Search reviews" className="w-full sm:w-72" />
            <FilterSelect label="Rating" value={filters.rating} onChange={(v) => setFilter('rating', v)} options={RATING_OPTIONS} />
            <FilterSelect label="Product" value={filters.product} onChange={(v) => setFilter('product', v)} options={products.data ?? []} className="max-w-[16rem]" />
            <label className={cn('inline-flex h-8 items-center gap-2 rounded-lg border pl-3 pr-2 text-[0.8125rem] font-medium shadow-sm', filters.from ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700')}>
              <span>From</span>
              <input
                type="date"
                value={filters.from}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setFilter('from', e.target.value)}
                aria-label="Reviews submitted from"
                className={cn('h-full bg-transparent tabular focus:outline-none', filters.from ? '[color-scheme:dark]' : 'text-zinc-600')}
              />
            </label>
            <ClearFiltersButton count={filterCount} onClear={clearFilters} />
          </>
        }
        bulkActions={(ids, clear) => (
          <>
            {canModerate && (
              <>
                <BulkButton icon={Check} disabled={busy} onClick={() => void act(ids, 'approved', clear)}>
                  Approve
                </BulkButton>
                <BulkButton icon={X} disabled={busy} onClick={() => void act(ids, 'rejected', clear)}>
                  Reject
                </BulkButton>
                <BulkButton icon={EyeOff} disabled={busy} onClick={() => void act(ids, 'hidden', clear)}>
                  Hide
                </BulkButton>
              </>
            )}
            {canDelete && (
              <BulkButton icon={Trash2} danger disabled={busy} onClick={() => void del(ids, clear)}>
                Delete
              </BulkButton>
            )}
          </>
        )}
        rowActions={(r) => <ReviewRowMenu review={r} canModerate={canModerate} canDelete={canDelete} onOpen={() => setOpenId(r.id)} onStatus={(s) => void act([r.id], s)} onDelete={() => void del([r.id])} />}
      />

      <ReviewDetailDrawer
        review={open}
        onClose={() => setOpenId(null)}
        onStatus={(s) => open && void act([open.id], s)}
        onDelete={() => open && void del([open.id])}
        busy={busy}
        canModerate={canModerate}
        canDelete={canDelete}
      />
    </div>
  );
}
