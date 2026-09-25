import { useMemo, useState } from 'react';
import { KeyRound, Pencil, Power, RotateCcw, UserPlus, Users } from 'lucide-react';
import type { AdminUser, AdminStatus } from '@/types';
import { settingsService, type AdminUserInput } from '@/services/settingsService';
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
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ClearFiltersButton } from '@/components/tables/Toolbar';
import { ReadOnlyBanner, SettingsLayout, useCanEditSettings } from '@/components/settings/SettingsKit';
import { AdminUserDrawer } from '@/components/settings/AdminUserDrawer';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

export default function AdminUsersPage() {
  const canEdit = useCanEditSettings();
  const session = useAuthStore((s) => s.session);
  const updateSession = useAuthStore((s) => s.updateSession);
  const meId = session?.user.id;
  const { filters, setFilter, resetFilters, activeCount } = useUrlFilters({ search: '', role: '', status: '' });
  const search = useDebounce(filters.search, 250);
  const users = useAsync(() => settingsService.getAdminUsers(search), [search]);
  const roles = useAsync(() => settingsService.getRoles(), []);
  const [drawer, setDrawer] = useState<{ open: boolean; user?: AdminUser }>({ open: false });

  const rows = useMemo(
    () => (users.data ?? []).filter((u) => (!filters.role || u.roleId === filters.role) && (!filters.status || u.status === filters.status)),
    [users.data, filters.role, filters.status],
  );

  const refresh = () => {
    void users.reload(true);
    void roles.reload(true);
  };

  const submit = async (input: AdminUserInput): Promise<string | null> => {
    try {
      if (drawer.user) {
        const updated = await settingsService.updateAdmin(drawer.user.id, input);
        toast.success('Admin updated.');
        if (updated.id === meId) {
          const role = (await settingsService.getRoles()).find((r) => r.id === updated.roleId);
          updateSession({ user: updated, ...(role ? { role } : {}) });
        }
      } else {
        const created = await settingsService.inviteAdmin(input);
        toast.success('Invitation sent.', { description: `${created.email} will receive a secure sign-up link.` });
      }
      refresh();
      return null;
    } catch (e) {
      toast.error(drawer.user ? 'Couldn’t update admin' : 'Couldn’t send invitation', { description: errMsg(e) });
      return errMsg(e);
    }
  };

  const setStatus = async (u: AdminUser, status: AdminStatus) => {
    const deactivate = status === 'deactivated';
    const ok = await confirm(
      deactivate
        ? { title: `Deactivate ${u.name}?`, description: `${u.name} will be signed out and can no longer access SPORTX Admin. You can reactivate the account at any time.`, confirmLabel: 'Deactivate' }
        : { title: `Reactivate ${u.name}?`, description: `${u.name} regains access with the ${u.roleName} role.`, confirmLabel: 'Reactivate', tone: 'default' },
    );
    if (!ok) return;
    try {
      await settingsService.setAdminStatus(u.id, status);
      toast.success(deactivate ? `${u.name} deactivated.` : `${u.name} reactivated.`);
      refresh();
    } catch (e) {
      toast.error(deactivate ? 'Couldn’t deactivate admin' : 'Couldn’t reactivate admin', { description: errMsg(e) });
    }
  };

  const resetAccess = async (u: AdminUser) => {
    const ok = await confirm({
      title: `Reset access for ${u.name}?`,
      description: `This revokes all of ${u.name}’s active sessions and emails a password reset link to ${u.email}.`,
      confirmLabel: 'Reset access',
      tone: 'default',
    });
    if (!ok) return;
    try {
      await settingsService.resetAccess(u.id);
      toast.success('Access reset.', { description: `Sessions revoked and a reset link sent to ${u.email}.` });
      void users.reload(true);
    } catch (e) {
      toast.error('Couldn’t reset access', { description: errMsg(e) });
    }
  };

  const columns: Column<AdminUser>[] = [
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
    { id: 'role', header: 'Role', sortValue: (u) => u.roleName, cell: (u) => <Badge tone={u.roleId === 'role_super_admin' ? 'brand' : 'neutral'}>{u.roleName}</Badge> },
    { id: 'status', header: 'Status', mobile: 'aside', sortValue: (u) => u.status, cell: (u) => <StatusBadge map={ADMIN_STATUS} value={u.status} /> },
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
  const statusOptions = (Object.keys(ADMIN_STATUS) as AdminStatus[]).map((s) => ({ value: s, label: ADMIN_STATUS[s].label }));

  return (
    <SettingsLayout
      title="Admin users"
      description="People who can sign in to SPORTX Admin and the role that defines what they can do."
      actions={
        canEdit && (
          <Button variant="primary" icon={UserPlus} onClick={() => setDrawer({ open: true })}>
            Add admin
          </Button>
        )
      }
    >
      {!canEdit && <ReadOnlyBanner />}
      <DataTable
        caption="Admin users"
        storageKey="settings-admin-users"
        data={rows}
        columns={columns}
        getRowId={(u) => u.id}
        loading={users.loading}
        error={users.error}
        onRetry={() => void users.reload()}
        initialSort={{ id: 'name', dir: 'asc' }}
        toolbar={
          <>
            <SearchInput value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search name, email or role…" className="w-full sm:w-72" />
            <FilterSelect label="Role" value={filters.role} onChange={(v) => setFilter('role', v)} options={roleOptions} />
            <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={statusOptions} />
            <ClearFiltersButton count={activeCount} onClear={resetFilters} />
          </>
        }
        empty={
          <EmptyState
            icon={Users}
            title={activeCount || filters.search ? 'No admins match these filters' : 'No admin users yet'}
            description={activeCount || filters.search ? 'Try a different search or clear the filters.' : 'Invite your team to start managing the store together.'}
            action={
              activeCount || filters.search ? (
                <Button size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : canEdit ? (
                <Button size="sm" variant="primary" icon={UserPlus} onClick={() => setDrawer({ open: true })}>
                  Add admin
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
                    { label: 'Deactivate', icon: Power, danger: true, separator: true, hidden: u.status === 'deactivated', onSelect: () => void setStatus(u, 'deactivated'), hint: u.id === meId ? 'You' : undefined },
                  ]}
                />
              )
            : undefined
        }
      />
      <AdminUserDrawer open={drawer.open} user={drawer.user} roles={roles.data ?? []} onClose={() => setDrawer((d) => ({ ...d, open: false }))} onSubmit={submit} />
    </SettingsLayout>
  );
}
