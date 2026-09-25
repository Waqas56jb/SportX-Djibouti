import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import type { SupportTicket, TicketCategory, TicketPriority, TicketStatus } from '@/types';
import { Button, EmptyState, PageHeader, Tabs } from '@/components/common';
import { FilterSelect, SearchInput } from '@/components/forms';
import { ClearFiltersButton, DataTable } from '@/components/tables';
import { useServerList } from '@/components/customers/useServerList';
import { TicketSummaryStrip, summaryFrom, type SummaryKey } from '@/components/support/TicketSummaryStrip';
import { ticketColumns } from '@/components/support/ticketColumns';
import { TICKET_CATEGORIES } from '@/constants/catalog';
import { TICKET_PRIORITY, TICKET_STATUS } from '@/constants/status';
import { supportService } from '@/services/supportService';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/misc';
import { useUrlFilters } from '@/hooks/useUrlFilters';

type TabValue = 'all' | TicketStatus;
const STATUSES = Object.keys(TICKET_STATUS) as TicketStatus[];
const PRIORITY_OPTIONS = (Object.keys(TICKET_PRIORITY) as TicketPriority[]).map((p) => ({ value: p, label: TICKET_PRIORITY[p].label }));
const CATEGORY_OPTIONS = TICKET_CATEGORIES.map((c) => ({ value: c.value, label: c.label }));

export default function SupportPage() {
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const { filters, setFilter, activeCount } = useUrlFilters({ status: '', priority: '', assignee: '', category: '', search: '' });
  const search = useDebounce(filters.search, 250);

  const tab: TabValue = STATUSES.includes(filters.status as TicketStatus) ? (filters.status as TicketStatus) : 'all';
  const baseFilters = { assignedToId: filters.assignee || undefined, category: filters.category as TicketCategory | '' };

  // Everything is server-side; the per-status counts ignore the status filter so tabs show totals.
  const list = useServerList(
    (q) => supportService.getTickets({ ...q, search, filters: { ...baseFilters, status: tab === 'all' ? '' : tab, priority: filters.priority as TicketPriority | '' } }),
    [search, tab, filters.priority, filters.assignee, filters.category],
    { initialSort: { id: 'updated', dir: 'desc' } },
  );
  const { loading, error, reload } = list;
  const rows = list.data?.data;
  const counts = list.data?.counts;
  // Unresolved urgent tickets for the summary tile (same search / assignee / category filters).
  const urgent = useAsync(() => supportService.getTickets({ pageSize: 1, search, filters: { ...baseFilters, priority: 'urgent' } }), [search, filters.assignee, filters.category]);
  const assignees = useAsync(() => supportService.getAssignees(), []);
  const assigneeOptions = useMemo(() => [{ value: 'unassigned', label: 'Unassigned' }, ...(assignees.data ?? []).map((a) => ({ value: a.id, label: a.name }))], [assignees.data]);

  const summary = useMemo(() => {
    if (!counts || !urgent.data) return undefined;
    const u = urgent.data.counts;
    return summaryFrom(counts, u.open + u.in_progress + u.waiting_customer);
  }, [counts, urgent.data]);

  const activeTile: SummaryKey | null = tab === 'open' || tab === 'in_progress' || tab === 'waiting_customer' ? tab : !filters.status && filters.priority === 'urgent' ? 'urgent' : null;

  const patchParams = (fn: (p: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        fn(next);
        return next;
      },
      { replace: true },
    );

  const onTile = (k: SummaryKey) => {
    if (k === 'urgent')
      patchParams((p) => {
        const on = activeTile === 'urgent';
        p.delete('status');
        if (on) p.delete('priority');
        else p.set('priority', 'urgent');
      });
    else setFilter('status', activeTile === k ? '' : k);
  };

  const filterCount = activeCount - (filters.status ? 1 : 0);
  const clearFilters = () => patchParams((p) => ['priority', 'assignee', 'category', 'search'].forEach((k) => p.delete(k)));
  const hasFilters = filterCount > 0 || Boolean(filters.search);

  return (
    <div>
      <PageHeader title="Support" description="Customer conversations, assignments and service levels." />

      <TicketSummaryStrip counts={summary} active={activeTile} onSelect={onTile} />

      <Tabs<TabValue>
        ariaLabel="Ticket status"
        className="mb-4"
        value={tab}
        onChange={(v) => setFilter('status', v === 'all' ? '' : v)}
        items={[{ value: 'all', label: 'All', count: counts?.all }, ...STATUSES.map((s) => ({ value: s, label: TICKET_STATUS[s].label, count: counts?.[s] }))]}
      />

      <DataTable
        caption="Support tickets"
        storageKey="support-tickets"
        data={rows}
        columns={ticketColumns}
        getRowId={(t: SupportTicket) => t.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        {...list.table}
        onRowClick={(t) => navigate(`/support/${t.id}`)}
        rowClassName={(t) => (t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed' ? 'shadow-[inset_3px_0_0_#dc2626]' : undefined)}
        toolbar={
          <>
            <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search ticket, customer, order…" label="Search tickets" className="w-full sm:w-72" />
            <FilterSelect label="Priority" value={filters.priority} onChange={(v) => setFilter('priority', v)} options={PRIORITY_OPTIONS} />
            <FilterSelect label="Assignee" value={filters.assignee} onChange={(v) => setFilter('assignee', v)} options={assigneeOptions} allLabel="Anyone" />
            <FilterSelect label="Category" value={filters.category} onChange={(v) => setFilter('category', v)} options={CATEGORY_OPTIONS} />
            <ClearFiltersButton count={filterCount} onClear={clearFilters} />
          </>
        }
        empty={
          <EmptyState
            icon={LifeBuoy}
            title="No support tickets."
            description={hasFilters || tab !== 'all' ? 'No ticket matches this view. Try another status or clear the filters.' : 'When customers contact support, their tickets will appear here.'}
            action={
              hasFilters ? (
                <Button size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
