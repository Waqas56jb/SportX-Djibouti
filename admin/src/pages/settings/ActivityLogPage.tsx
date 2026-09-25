import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, History, RadioTower, RotateCw } from 'lucide-react';
import type { ActivityLog } from '@/types';
import { activityService, moduleLabel, type ActivityFilters } from '@/services/activityService';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/misc';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import type { StatusMeta } from '@/constants/status';
import { toast } from '@/store/toastStore';
import { exportCsv } from '@/utils/csv';
import { formatDateTime, formatRelative } from '@/utils/format';
import { Badge, StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Misc';
import { EmptyState } from '@/components/common/States';
import { DateInput, FilterSelect, SearchInput } from '@/components/forms/Inputs';
import { DataTable, type Column, type SortState } from '@/components/tables/DataTable';
import { ClearFiltersButton } from '@/components/tables/Toolbar';
import { Callout, SettingsLayout } from '@/components/settings/SettingsKit';
import { errorMessage } from '@/components/settings/formErrors';

const RESULT: Record<ActivityLog['status'], StatusMeta> = {
  success: { label: 'Success', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
};

/** Table column → API sort key (the API sorts by date or action only). */
const SORT_KEYS: Record<string, ActivityFilters['sort']> = { date: 'created_at', action: 'action' };

const startOfDay = (v: string) => (v ? new Date(`${v}T00:00:00`).toISOString() : undefined);
const endOfDay = (v: string) => (v ? new Date(`${v}T23:59:59.999`).toISOString() : undefined);
const EXPORT_LIMIT = 100;

export default function ActivityLogPage() {
  const { filters, setFilter, setFilters, resetFilters, activeCount } = useUrlFilters({ search: '', admin: '', module: '', action: '', status: '', from: '', to: '' });
  const search = useDebounce(filters.search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<SortState>({ id: 'date', dir: 'desc' });
  const [exporting, setExporting] = useState(false);

  const query: ActivityFilters = {
    search,
    adminId: filters.admin || undefined,
    module: filters.module || undefined,
    action: filters.action || undefined,
    status: filters.status === 'success' || filters.status === 'failed' ? filters.status : undefined,
    from: startOfDay(filters.from),
    to: endOfDay(filters.to),
    sort: SORT_KEYS[sort.id] ?? 'created_at',
    order: sort.dir,
  };
  const key = JSON.stringify(query);

  useEffect(() => setPage(1), [key, pageSize]);
  const logs = useAsync(() => activityService.list({ ...query, page, limit: pageSize }), [key, page, pageSize]);
  const opts = useAsync(() => activityService.filters(), []);

  const options = useMemo(() => {
    const o = opts.data;
    return {
      admins: (o?.admins ?? []).map((a) => ({ value: a.id, label: a.name || 'Unnamed admin' })),
      modules: (o?.modules ?? []).map((m) => ({ value: m, label: moduleLabel(m) })),
      actions: [...new Set([...(o?.actions ?? []), ...(filters.action ? [filters.action] : [])])].map((a) => ({ value: a, label: a })),
    };
  }, [opts.data, filters.action]);

  const total = logs.data?.pagination.total ?? 0;

  const columns: Column<ActivityLog>[] = [
    {
      id: 'admin',
      header: 'Admin',
      mobile: 'subtitle',
      cell: (a) => (
        <span className="flex items-center gap-2.5" title={a.adminEmail}>
          <Avatar name={a.adminName} size={28} />
          <span className="truncate font-medium text-zinc-900">{a.adminName}</span>
        </span>
      ),
    },
    { id: 'action', header: 'Action', mobile: 'title', hideable: false, sortValue: (a) => a.action, cell: (a) => <span className="font-medium text-zinc-900">{a.action}</span> },
    { id: 'module', header: 'Module', cell: (a) => <Badge tone={a.module === 'settings' || a.module === 'staff' || a.module === 'role' ? 'info' : 'neutral'}>{moduleLabel(a.module)}</Badge> },
    {
      id: 'record',
      header: 'Record',
      cell: (a) =>
        a.recordLink ? (
          <Link to={a.recordLink} className="block max-w-[260px] truncate font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900" title={a.record} onClick={(e) => e.stopPropagation()}>
            {a.record || 'Open'}
          </Link>
        ) : (
          <span className="block max-w-[260px] truncate text-zinc-600" title={a.record}>
            {a.record || '—'}
          </span>
        ),
    },
    {
      id: 'date',
      header: 'Date',
      sortValue: (a) => a.createdAt,
      cell: (a) => (
        <span className="block whitespace-nowrap">
          <span className="block tabular text-zinc-800">{formatDateTime(a.createdAt)}</span>
          <span className="block text-xs text-zinc-500">{formatRelative(a.createdAt)}</span>
        </span>
      ),
    },
    { id: 'ip', header: 'IP address', cell: (a) => <span className="font-mono text-xs text-zinc-600" title={a.userAgent}>{a.ipAddress || '—'}</span> },
    { id: 'status', header: 'Status', mobile: 'aside', cell: (a) => <StatusBadge map={RESULT} value={a.status} /> },
  ];

  /** Exports the first 100 entries matching the current filters (the API page size limit). */
  const exportRows = async () => {
    setExporting(true);
    try {
      const { data } = await activityService.list({ ...query, page: 1, limit: EXPORT_LIMIT });
      exportCsv('activity-log', data, [
        { header: 'Date', value: (a) => a.createdAt },
        { header: 'Admin', value: (a) => a.adminName },
        { header: 'Admin email', value: (a) => a.adminEmail ?? '' },
        { header: 'Action', value: (a) => a.action },
        { header: 'Module', value: (a) => moduleLabel(a.module) },
        { header: 'Record', value: (a) => a.record },
        { header: 'IP address', value: (a) => a.ipAddress },
        { header: 'Status', value: (a) => RESULT[a.status].label },
      ]);
      if (total > EXPORT_LIMIT) toast.info(`Exported the latest ${EXPORT_LIMIT} of ${total} entries.`, { description: 'Narrow the filters to export a specific range.' });
    } catch (e) {
      toast.error('Couldn’t export the activity log', { description: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = activeCount > 0 || Boolean(filters.search);

  return (
    <SettingsLayout
      title="Activity log"
      description="An audit trail of every important change made in SPORTX Admin — who did what, when and from where."
      actions={
        <>
          <Button icon={RotateCw} onClick={() => void logs.reload()} aria-label="Refresh activity log">
            Refresh
          </Button>
          <Button icon={Download} onClick={() => void exportRows()} loading={exporting} disabled={!total || logs.loading}>
            Export CSV
          </Button>
        </>
      }
    >
      <Callout icon={RadioTower} tone="info" className="mb-5" title="Recorded automatically">
        The API writes an entry whenever an admin changes products, stock, orders, customers, marketing, settings, admin users or roles. The log is read-only and cannot be edited or deleted.
      </Callout>

      <DataTable
        caption="Admin activity log"
        storageKey="settings-activity"
        data={logs.data?.data}
        columns={columns}
        getRowId={(a) => a.id}
        loading={logs.loading}
        error={logs.error}
        onRetry={() => void logs.reload()}
        sort={sort}
        onSortChange={setSort}
        serverPagination={{ page, pageSize, total, onPageChange: setPage, onPageSizeChange: setPageSize }}
        toolbar={
          <>
            <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search action, record or admin…" className="w-full sm:w-72" />
            <FilterSelect label="Admin" value={filters.admin} onChange={(v) => setFilter('admin', v)} options={options.admins} />
            <FilterSelect label="Module" value={filters.module} onChange={(v) => setFilters({ module: v, action: '' })} options={options.modules} />
            <FilterSelect label="Action" value={filters.action} onChange={(v) => setFilter('action', v)} options={options.actions} />
            <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={[{ value: 'success', label: 'Success' }, { value: 'failed', label: 'Failed' }]} />
            <div className="flex items-center gap-1.5">
              <DateInput aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} inputClassName="!h-8 w-[9.5rem] text-[0.8125rem]" />
              <span className="text-xs text-zinc-400" aria-hidden>
                –
              </span>
              <DateInput aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} inputClassName="!h-8 w-[9.5rem] text-[0.8125rem]" />
            </div>
            <ClearFiltersButton count={activeCount} onClear={resetFilters} />
          </>
        }
        toolbarRight={
          !logs.loading && (
            <span className="text-xs text-zinc-500 tabular">
              {total} {total === 1 ? 'entry' : 'entries'}
            </span>
          )
        }
        empty={
          <EmptyState
            icon={History}
            title={hasFilters ? 'No activity matches these filters' : 'No activity yet'}
            description={hasFilters ? 'Try a wider date range or clear the filters.' : 'Actions taken by admins will appear here as they happen.'}
            action={
              hasFilters ? (
                <Button size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />
    </SettingsLayout>
  );
}
