import { useMemo } from 'react';
import { Info, Lock, PencilRuler, Users } from 'lucide-react';
import type { Customer, CustomerGroup } from '@/types';
import { Button, DemoBadge, EmptyState, ErrorState, PageHeader } from '@/components/common';
import { SearchInput } from '@/components/forms';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { GROUP_ICON, GroupCard } from '@/components/customers/GroupCard';
import { CUSTOMER_GROUPS, customerService } from '@/services/customerService';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/misc';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { formatMoney, formatNumber } from '@/utils/format';

const isGroup = (v: string): v is CustomerGroup => CUSTOMER_GROUPS.some((g) => g.id === v);

export default function CustomerGroupsPage() {
  const { filters, setFilter } = useUrlFilters({ group: 'all', search: '' });
  const group: CustomerGroup = isGroup(filters.group) ? filters.group : 'all';
  const meta = CUSTOMER_GROUPS.find((g) => g.id === group) ?? CUSTOMER_GROUPS[0];
  const search = useDebounce(filters.search, 250);

  const summary = useAsync(() => customerService.getGroupSummary(), []);
  const list = useAsync(() => customerService.getCustomers({ group: group === 'all' ? '' : group, search }), [group, search]);

  const byId = useMemo(() => new Map((summary.data ?? []).map((s) => [s.id, s])), [summary.data]);
  const total = byId.get('all')?.count ?? 0;
  const current = byId.get(group);
  const GroupIcon = GROUP_ICON[group];

  const onUpdated = (c: Customer) => {
    list.setData((rows) => rows?.map((x) => (x.id === c.id ? c : x)));
    void summary.reload(true);
  };

  return (
    <div>
      <PageHeader
        title="Customer groups"
        backTo="/customers"
        backLabel="Customers"
        description="Segments update automatically from customer behaviour. Select a group to see who is in it."
        actions={<DemoBadge />}
      />

      {summary.error ? (
        <div className="panel mb-6">
          <ErrorState compact description="We couldn’t load group totals." onRetry={() => void summary.reload()} />
        </div>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" role="group" aria-label="Customer groups">
          {CUSTOMER_GROUPS.map((g) => {
            const s = byId.get(g.id);
            return (
              <GroupCard
                key={g.id}
                id={g.id}
                label={g.label}
                description={g.description}
                rule={g.rule}
                count={summary.loading ? undefined : (s?.count ?? 0)}
                revenue={s?.revenue}
                share={s && total ? s.count / total : undefined}
                selected={g.id === group}
                onSelect={() => setFilter('group', g.id)}
              />
            );
          })}
        </div>
      )}

      <section className="panel mb-6 p-5" aria-labelledby="segment-rule-title">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-volt">
              <GroupIcon size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="segment-rule-title" className="panel-title">
                {meta.label}
              </h2>
              <p className="mt-0.5 text-[0.8125rem] text-zinc-500">
                {current ? `${formatNumber(current.count)} customers · ${formatMoney(current.revenue)} lifetime revenue` : meta.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="eyebrow mr-1">Rule</span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700">
                  <Lock size={12} className="text-zinc-400" aria-hidden /> {meta.rule}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-500">Auto-updated daily</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1.5 md:items-end">
            <span title="Rule builder available once backend is connected" className="inline-flex">
              <Button icon={PencilRuler} disabled aria-describedby="rule-builder-hint">
                Edit rule
              </Button>
            </span>
            <span id="rule-builder-hint" className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <Info size={12} aria-hidden /> Rule builder available once backend is connected.
            </span>
          </div>
        </div>
      </section>

      <CustomerTable
        caption={`Customers in ${meta.label}`}
        storageKey="customer-groups"
        data={list.data}
        loading={list.loading}
        error={list.error}
        onRetry={() => void list.reload()}
        onUpdated={onUpdated}
        toolbar={<SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder={`Search ${meta.label.toLowerCase()}…`} label="Search customers in group" className="w-full sm:w-72" />}
        empty={<EmptyState icon={Users} title="No customers found." description={filters.search ? 'No customer in this group matches your search.' : 'Nobody currently matches this group’s rule.'} />}
      />
    </div>
  );
}
