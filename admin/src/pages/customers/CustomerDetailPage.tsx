import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BellOff, BellRing, CalendarDays, ChevronDown, Pencil, UserX } from 'lucide-react';
import type { Customer } from '@/types';
import { Avatar, Badge, Button, EmptyState, ErrorState, Menu, PageHeader, PageSkeleton, StatusBadge } from '@/components/common';
import { CustomerFormDrawer } from '@/components/customers/CustomerFormDrawer';
import { AddressesPanel, ContactPanel, CustomerStats } from '@/components/customers/CustomerOverview';
import { CustomerReviewsPanel, CustomerTicketsPanel, RecentOrdersPanel, WishlistPanel } from '@/components/customers/CustomerRelated';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { fullName, statusMenuItems, useCustomerStatus } from '@/components/customers/useCustomerStatus';
import { CUSTOMER_GROUPS, customerService } from '@/services/customerService';
import { CUSTOMER_STATUS } from '@/constants/status';
import { useAsync } from '@/hooks/useAsync';
import { usePermission } from '@/hooks/usePermission';
import { formatDate } from '@/utils/format';

const isNotFound = (e: Error | null) => Boolean(e && ((e as Error & { status?: number }).status === 404 || /not found/i.test(e.message)));

export default function CustomerDetailPage() {
  const { id = '' } = useParams();
  const { data: c, loading, error, reload, setData } = useAsync(() => customerService.getCustomer(id), [id]);
  const canEdit = usePermission('customers:edit');
  const { change, pendingId } = useCustomerStatus();
  const [editing, setEditing] = useState(false);
  const [activityKey, setActivityKey] = useState(0);

  const applyUpdate = (next: Customer) => {
    setData(next);
    setActivityKey((k) => k + 1);
  };

  if (loading && !c) return <PageSkeleton />;

  if (isNotFound(error)) {
    return (
      <div className="panel">
        <EmptyState
          icon={UserX}
          title="Customer not found"
          description="This customer may have been removed, or the link is incorrect."
          action={
            <Link to="/customers" className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink-950 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-ink-800">
              <ArrowLeft size={16} aria-hidden /> Back to customers
            </Link>
          }
        />
      </div>
    );
  }

  if (error || !c) {
    return (
      <div className="panel">
        <ErrorState description="We couldn’t load this customer. Please try again." onRetry={() => void reload()} />
      </div>
    );
  }

  const name = fullName(c);
  const groups = CUSTOMER_GROUPS.filter((g) => g.id !== 'all' && c.groups.includes(g.id));

  return (
    <div>
      <PageHeader
        backTo="/customers"
        backLabel="Customers"
        documentTitle={name}
        title={
          <span className="flex items-center gap-3.5">
            <Avatar name={name} src={c.avatarUrl} size={48} className="ring-4 ring-white shadow-card" />
            <span className="min-w-0 truncate">{name}</span>
          </span>
        }
        meta={
          <>
            <StatusBadge map={CUSTOMER_STATUS} value={c.status} size="md" />
            <Badge size="md" tone={c.marketingOptIn ? 'success' : 'muted'}>
              {c.marketingOptIn ? <BellRing size={12} aria-hidden /> : <BellOff size={12} aria-hidden />}
              {c.marketingOptIn ? 'Marketing opt-in' : 'No marketing'}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-zinc-500">
              <CalendarDays size={14} aria-hidden /> Joined {formatDate(c.joinedAt)}
            </span>
            {groups.map((g) => (
              <Link key={g.id} to={`/customers/groups?group=${g.id}`} className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:text-zinc-900">
                {g.label}
              </Link>
            ))}
          </>
        }
        actions={
          canEdit ? (
            <>
              <Menu
                label="Change status"
                width={210}
                items={statusMenuItems(
                  c,
                  async (s) => {
                    const updated = await change(c, s);
                    if (updated) applyUpdate(updated);
                  },
                  false,
                )}
                trigger={(p) => (
                  <Button {...p} iconRight={ChevronDown} loading={pendingId === c.id}>
                    Change status
                  </Button>
                )}
              />
              <Button variant="primary" icon={Pencil} onClick={() => setEditing(true)}>
                Edit customer
              </Button>
            </>
          ) : undefined
        }
      />

      <CustomerStats customer={c} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <RecentOrdersPanel customerId={c.id} email={c.email} />
          <div className="grid gap-6 xl:grid-cols-2">
            <CustomerReviewsPanel customerId={c.id} />
            <CustomerTicketsPanel customerId={c.id} />
          </div>
          <CustomerTimeline customerId={c.id} refreshKey={activityKey} />
        </div>
        <div className="min-w-0 space-y-6">
          <ContactPanel customer={c} />
          <WishlistPanel items={c.wishlist ?? []} count={c.wishlistProductIds.length} />
          <AddressesPanel customer={c} />
        </div>
      </div>

      <CustomerFormDrawer customer={editing ? c : null} onClose={() => setEditing(false)} onSaved={applyUpdate} />
    </div>
  );
}
