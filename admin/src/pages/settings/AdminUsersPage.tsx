import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Power, RotateCcw, UserPlus, Users } from 'lucide-react';
import { settingsService } from '@/services/settingsService';
import { staffService, type AdminUserInput, type StaffMember, type StaffSort } from '@/services/staffService';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/misc';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { ADMIN_STATUS } from '@/constants/status';
import { formatDateTime, formatRelative } from '@/utils/format';
import { Badge, StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Menu } from '@/components/common/Menu';
import { Avatar } from '@/components/common/Misc';
import { EmptyState } from '@/components/common/States';
import { FilterSelect, SearchInput } from '@/components/forms/Inputs';
import { DataTable, type Column, type SortState } from '@/components/tables/DataTable';
import { ClearFiltersButton } from '@/components/tables/Toolbar';
import { ReadOnlyBanner, SettingsLayout, useCanEditSettings } from '@/components/settings/SettingsKit';
import { AdminUserDrawer } from '@/components/settings/AdminUserDrawer';
import { errorMessage, handleFormError, type FieldErrors } from '@/components/settings/formErrors';

/** Table column → API sort key. */
const SORT_KEYS: Record<string, StaffSort> = { name: 'name', email: 'email', lastLogin: 'last_login_at', created: 'created_at' };
/** "Invited" is derived (never signed in), so the server can only filter active vs deactivated. */
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'deactivated', label: 'Deactivated' },
];
const DRAWER_FIELDS = ['name', 'email', 'phone', 'roleId'] as const;
const FIELD_ALIAS = { firstName: 'name', lastName: 'name', roleSlug: 'roleId' };

export default function AdminUsersPage() {
  const canEdit = useCanEditSettings();
  const session = useAuthStore((s) => s.session);
  const updateSession = useAuthStore((s) => s.updateSession);
  const meId = session?.user.id;
  const { filters, setFilter, resetFilters, activeCount } = useUrlFilters({ search: '', role: '', status: '' });
  const search = useDebounce(filters.search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<SortState>({ id: 'name', dir: 'asc' });

  // New filters → back to the first page.
  useEffect(() => setPage(1), [search, filters.role, filters.status, pageSize, sort.id, sort.dir]);

  const users = useAsync(
    () =>
      staffService.list({
        page,
        limit: pageSize,
        search,
        role: filters.role,
        status: filters.status === 'active' || filters.status === 'deactivated' ? filters.status : '',
        sort: SORT_KEYS[sort.id] ?? 'name',
        order: sort.dir,
      }),
    [page, pageSize, search, filters.role, filters.status, sort.id, sort.dir],
  );
  const roles = useAsync(() => settingsService.getRoles(), []);
  const [drawer, setDrawer] = useState<{ open: boolean; user?: StaffMember }>({ open: false });

  const refresh = () => {
    void users.reload(true);
    void roles.reload(true);
  };

  const submit = async (input: AdminUserInput): Promise<FieldErrors | null> => {
    try {
      if (drawer.user) {
        const updated = await staffService.update(drawer.user.id, { name: input.name, phone: input.phone ?? '', roleId: input.roleId });
        toast.success('Admin updated.');
        if (updated.id === meId && session) updateSession({ user: { ...session.user, name: updated.name, phone: updated.phone } });
      } else {
        const created = await staffService.invite(input);
        toast.success('Invitation sent.', { description: `${created.email} will receive an email link to set their own password.` });
      }
      refresh();
      return null;
    } catch (e) {
      return handleFormError(e, drawer.user ? 'Couldn’t update admin' : 'Couldn’t send invitation', { alias: FIELD_ALIAS, fields: DRAWER_FIELDS });
    }
  };

  const setStatus = async (u: StaffMember, status: 'active' | 'deactivated') => {
    const deactivate = status === 'deactivated';
    const ok = await confirm(
      deactivate
        ? { title: `Deactivate ${u.name}?`, description: `${u.name} will be signed out everywhere and can no longer access SPORTX Admin. You can reactivate the account at any time.`, confirmLabel: 'Deactivate' }
        : { title: `Reactivate ${u.name}?`, description: `${u.name} regains access with the ${u.roleName} role.`, confirmLabel: 'Reactivate', tone: 'default' },
    );
    if (!ok) return;
    try {
      await staffService.setStatus(u.id, status);
      toast.success(deactivate ? `${u.name} deactivated.` : `${u.name} reactivated.`);
      refresh();
    } catch (e) {
      toast.error(deactivate ? 'Couldn’t deactivate admin' : 'Couldn’t reactivate admin', { description: errorMessage(e) });
    }
  };

  const resetAccess = async (u: StaffMember) => {
    const ok = await confirm({
      title: `Reset access for ${u.name}?`,
      description: `This signs ${u.name} out of every device and emails a password reset link to ${u.email}.`,
      confirmLabel: 'Reset access',
      tone: 'default',
    });
    if (!ok) return;
    try {
      const res = await staffService.resetAccess(u.id);
      toast.success('Access reset.', { description: res.resetEmailSent ? `Sessions revoked and a reset link sent to ${u.email}.` : 'Sessions revoked. No email was sent because the account is not active.' });
      void users.reload(true);
    } catch (e) {
      toast.error('Couldn’t reset access', { description: errorMessage(e) });
    }
  };

  const columns: Column<StaffMember>[] = [
    {
      id: 'name',
      header: 'Name',
      mobile: 'title',
      hideable: false,
      sortValue: (u) => u.name,
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={u.name} src={u.avatarUrl} size={34} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[0.8125rem] font-medium text-zinc-900">
              {u.name}
              {u.id === meId && <Badge tone="brand">You</Badge>}
            </p>
            <p className="truncate text-xs text-zinc-500">{u.email}</p>
          </div>
        </div>
      ),
    },
    { id: 'email', header: 'Email', mobile: 'hidden', defaultHidden: true, sortValue: (u) => u.email, cell: (u) => <span className="text-zinc-600">{u.email}</span> },
    { id: 'phone', header: 'Phone', mobile: 'hidden', defaultHidden: true, cell: (u) => <span className="tabular text-zinc-600">{u.phone || '—'}</span> },
    { id: 'role', header: 'Role', cell: (u) => <Badge tone={u.roleSlug === 'super_admin' ? 'brand' : 'neutral'}>{u.roleName}</Badge> },
    { id: 'status', header: 'Status', mobile: 'aside', cell: (u) => <StatusBadge map={ADMIN_STATUS} value={u.status} /> },
    {
      id: 'lastLogin',
      header: 'Last login',
      sortValue: (u) => u.lastLoginAt ?? '',
      cell: (u) =>
        u.lastLoginAt ? (
          <span title={formatDateTime(u.lastLoginAt)} className="tabular">
            {formatRelative(u.lastLoginAt)}
          </span>
        ) : (
          <span className="text-zinc-400">{u.status === 'invited' ? 'Invitation pending' : 'Never'}</span>
        ),
    },
    { id: 'created', header: 'Added', defaultHidden: true, sortValue: (u) => u.createdAt, cell: (u) => <span className="tabular">{formatDateTime(u.createdAt)}</span> },
  ];

  const roleOptions = (roles.data ?? []).map((r) => ({ value: r.id, label: r.name }));
  const hasFilters = activeCount > 0 || Boolean(filters.search);

  return (
    <SettingsLayout
      title="Admin users"
      description="People who can sign in to SPORTX Admin and the role that defines what they can do."
      actions={
        canEdit && (
          <Button variant="primary" icon={UserPlus} onClick={() => setDrawer({ open: true })}>
            Invite admin
          </Button>
        )
      }
    >
      {!canEdit && <ReadOnlyBanner />}
      <DataTable
        caption="Admin users"
        storageKey="settings-admin-users"
        data={users.data?.data}
        columns={columns}
        getRowId={(u) => u.id}
        loading={users.loading}
        error={users.error}
        onRetry={() => void users.reload()}
        sort={sort}
        onSortChange={setSort}
        serverPagination={{ page, pageSize, total: users.data?.pagination.total ?? 0, onPageChange: setPage, onPageSizeChange: setPageSize }}
        toolbar={
          <>
            <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search name or email…" className="w-full sm:w-72" />
            <FilterSelect label="Role" value={filters.role} onChange={(v) => setFilter('role', v)} options={roleOptions} />
            <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={STATUS_OPTIONS} />
            <ClearFiltersButton count={activeCount} onClear={resetFilters} />
          </>
        }
        empty={
          <EmptyState
            icon={Users}
            title={hasFilters ? 'No admins match these filters' : 'No admin users yet'}
            description={hasFilters ? 'Try a different search or clear the filters.' : 'Invite your team to start managing the store together.'}
            action={
              hasFilters ? (
                <Button size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : canEdit ? (
                <Button size="sm" variant="primary" icon={UserPlus} onClick={() => setDrawer({ open: true })}>
                  Invite admin
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          canEdit
            ? (u) => (
                <Menu
                  label={`Actions for ${u.name}`}
                  items={[
                    { label: 'Edit admin', icon: Pencil, onSelect: () => setDrawer({ open: true, user: u }) },
                    { label: 'Reset access', icon: KeyRound, onSelect: () => void resetAccess(u), hidden: u.status === 'deactivated' },
                    { label: 'Reactivate', icon: RotateCcw, separator: true, hidden: u.status !== 'deactivated', onSelect: () => void setStatus(u, 'active') },
                    { label: 'Deactivate', icon: Power, danger: true, separator: true, hidden: u.status === 'deactivated' || u.id === meId, onSelect: () => void setStatus(u, 'deactivated') },
                  ]}
                />
              )
            : undefined
        }
      />
      <AdminUserDrawer open={drawer.open} user={drawer.user} roles={roles.data ?? []} selfId={meId} onClose={() => setDrawer((d) => ({ ...d, open: false }))} onSubmit={submit} />
    </SettingsLayout>
  );
}
