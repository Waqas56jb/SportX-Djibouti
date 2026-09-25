import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Download, History, RadioTower, RotateCw } from 'lucide-react';
import type { ActivityLog } from '@/types';
import { settingsService, type ActivityFilters } from '@/services/settingsService';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/misc';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import type { StatusMeta } from '@/constants/status';
import { exportCsv } from '@/utils/csv';
import { formatDateTime, formatRelative } from '@/utils/format';
import { Badge, StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Misc';
import { EmptyState } from '@/components/common/States';
import { DateInput, FilterSelect, SearchInput } from '@/components/forms/Inputs';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ClearFiltersButton } from '@/components/tables/Toolbar';
import { Callout, SettingsLayout } from '@/components/settings/SettingsKit';

const RESULT: Record<ActivityLog['status'], StatusMeta> = {
  success: { label: 'Success', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
};

const BASE_MODULES = ['Auth', 'Catalog', 'Customers', 'Inventory', 'Marketing', 'Orders', 'Products', 'Reviews', 'Settings', 'Support'];

const startOfDay = (v: string) => (v ? new Date(`${v}T00:00:00`).toISOString() : undefined);
const endOfDay = (v: string) => (v ? new Date(`${v}T23:59:59.999`).toISOString() : undefined);
const uniqueSorted = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));

export default function ActivityLogPage() {
  const { filters, setFilter, resetFilters, activeCount } = useUrlFilters({ search: '', admin: '', module: '', action: '', from: '', to: '' });
  const search = useDebounce(filters.search, 250);
  const query: ActivityFilters = { search, adminId: filters.admin || undefined, module: filters.module || undefined, action: filters.action || undefined, from: startOfDay(filters.from), to: endOfDay(filters.to) };
  const logs = useAsync(() => settingsService.getActivityLogs(query), [search, filters.admin, filters.module, filters.action, filters.from, filters.to]);
  // Unfiltered list feeds the filter options (admins, modules, actions actually present in the trail).
  const all = useAsync(() => settingsService.getActivityLogs(), []);

  const options = useMemo(() => {
    const src = all.data ?? [];
    const admins = new Map<string, string>();
    src.forEach((a) => admins.set(a.adminId, a.adminName));
    return {
      admins: [...admins].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
      modules: uniqueSorted([...BASE_MODULES, ...src.map((a) => a.module)]).map((m) => ({ value: m, label: m })),
      actions: uniqueSorted([...src.filter((a) => !filters.module || a.module === filters.module).map((a) => a.action), ...(filters.action ? [filters.action] : [])]).map((a) => ({ value: a, label: a })),
    };
  }, [all.data, filters.module, filters.action]);

  const rows = logs.data ?? [];
  const failed = rows.filter((r) => r.status === 'failed').length;

  const columns: Column<ActivityLog>[] = [
    {
      id: 'admin',
      header: 'Admin',
      mobile: 'subtitle',
      sortValue: (a) => a.adminName,
      cell: (a) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={a.adminName} size={28} />
          <span className="truncate font-medium text-zinc-900">{a.adminName}</span>
        </span>
      ),
    },
    { id: 'action', header: 'Action', mobile: 'title', hideable: false, sortValue: (a) => a.action, cell: (a) => <span className="font-medium text-zinc-900">{a.action}</span> },
    { id: 'module', header: 'Module', sortValue: (a) => a.module, cell: (a) => <Badge tone={a.module === 'Settings' || a.module === 'Auth' ? 'info' : 'neutral'}>{a.module}</Badge> },
    {
      id: 'record',
      header: 'Record',
      cell: (a) =>
        a.recordLink ? (
          <Link to={a.recordLink} className="block max-w-[260px] truncate font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900" title={a.record} onClick={(e) => e.stopPropagation()}>
            {a.record}
          </Link>
        ) : (
          <span className="block max-w-[260px] truncate text-zinc-600" title={a.record}>
            {a.record}
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
    { id: 'ip', header: 'IP address', cell: (a) => <span className="font-mono text-xs text-zinc-600">{a.ipAddress}</span> },
    { id: 'status', header: 'Status', mobile: 'aside', sortValue: (a) => a.status, cell: (a) => <StatusBadge map={RESULT} value={a.status} /> },
  ];

  const exportRows = () =>
    exportCsv('activity-log', rows, [
      { header: 'Date', value: (a) => a.createdAt },
      { header: 'Admin', value: (a) => a.adminName },
      { header: 'Action', value: (a) => a.action },
      { header: 'Module', value: (a) => a.module },
      { header: 'Record', value: (a) => a.record },
      { header: 'IP address', value: (a) => a.ipAddress },
      { header: 'Status', value: (a) => RESULT[a.status].label },
    ]);

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
          <Button icon={Download} onClick={exportRows} disabled={!rows.length || logs.loading}>
            Export CSV
          </Button>
        </>
      }
    >
      <Callout icon={RadioTower} tone="info" className="mb-5" title="Recorded automatically">
        Entries are written by the services whenever an admin creates a product, adjusts stock, updates an order, changes settings and more — try an action elsewhere and refresh. The log is read-only; IP addresses shown are placeholders until the API records real ones.
      </Callout>

      <DataTable
        caption="Admin activity log"
        storageKey="settings-activity"
        data={rows}
        columns={columns}
        getRowId={(a) => a.id}
        loading={logs.loading}
        error={logs.error}
        onRetry={() => void logs.reload()}
        pageSize={20}
        initialSort={{ id: 'date', dir: 'desc' }}
        toolbar={
          <>
            <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search action, record or admin…" className="w-full sm:w-72" />
            <FilterSelect label="Admin" value={filters.admin} onChange={(v) => setFilter('admin', v)} options={options.admins} />
            <FilterSelect
              label="Module"
              value={filters.module}
              onChange={(v) => setFilter('module', v)}
              options={options.modules}
            />
            <FilterSelect label="Action" value={filters.action} onChange={(v) => setFilter('action', v)} options={options.actions} />
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
              {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
              {failed > 0 && <span className="ml-1.5 font-medium text-red-600">· {failed} failed</span>}
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
