import { useEffect, useMemo, useState } from 'react';
import { Lock, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PermissionKey, Role } from '@/types';
import { roleService, type RoleInput } from '@/services/roleService';
import { useAsync } from '@/hooks/useAsync';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { ALL_PERMISSIONS } from '@/constants/permissions';
import { formatDate } from '@/utils/format';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState, Skeleton, SkeletonPanel } from '@/components/common/States';
import { FormGrid } from '@/components/forms/Field';
import { Input, Textarea } from '@/components/forms/Inputs';
import { Callout, ReadOnlyBanner, SaveBar, SettingsLayout, useCanEditSettings } from '@/components/settings/SettingsKit';
import { PermissionMatrix } from '@/components/settings/PermissionMatrix';
import { CreateRoleModal, RoleList } from '@/components/settings/RoleDialogs';
import { sortPerms } from '@/components/settings/permissionRules';
import { errorMessage, handleFormError, type FieldErrors } from '@/components/settings/formErrors';

interface Draft {
  name: string;
  description: string;
  permissions: PermissionKey[];
}

const toDraft = (r: Role): Draft => ({ name: r.name, description: r.description, permissions: sortPerms(r.permissions) });

export default function RolesPage() {
  const canEdit = useCanEditSettings();
  const session = useAuthStore((s) => s.session);
  const restoreSession = useAuthStore((s) => s.restore);
  const { data: roles, loading, error, reload, setData } = useAsync(() => roleService.list(), []);
  // Server catalogue — used to flag a mismatch with the matrix built from constants/permissions.
  const catalogue = useAsync(() => roleService.permissions(), []);
  const unknownKeys = useMemo(() => {
    const known = new Set<string>(ALL_PERMISSIONS);
    return (catalogue.data ?? []).flatMap((g) => g.permissions.map((p) => p.key)).filter((k) => !known.has(k));
  }, [catalogue.data]);
  const { filters, setFilter } = useUrlFilters({ role: '' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [nameError, setNameError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const selected = useMemo(() => roles?.find((r) => r.id === filters.role) ?? roles?.[0], [roles, filters.role]);
  const locked = selected?.slug === 'super_admin' || Boolean((selected as { immutable?: boolean } | undefined)?.immutable);
  const readOnly = !canEdit || locked;

  useEffect(() => {
    setDraft(selected ? toDraft(selected) : null);
    setNameError(undefined);
  }, [selected]);

  const dirty = Boolean(selected && draft && JSON.stringify(draft) !== JSON.stringify(toDraft(selected)));

  const select = async (r: Role) => {
    if (r.id === selected?.id) return;
    if (dirty && !(await confirm({ title: 'Discard unsaved changes?', description: `Your changes to ${selected?.name} haven’t been saved.`, confirmLabel: 'Discard changes' }))) return;
    setFilter('role', r.id);
  };

  const save = async () => {
    if (!selected || !draft) return;
    if (!draft.name.trim()) return setNameError('Role name is required.');
    setSaving(true);
    try {
      const updated = await roleService.update(selected.id, { ...draft, name: draft.name.trim(), description: draft.description.trim() });
      setData((list) => list?.map((r) => (r.id === updated.id ? updated : r)));
      const own = Boolean(session?.roles?.some((r) => r.id === updated.id) ?? session?.role.id === updated.id);
      // Re-read the identity so permission checks use the server's effective permissions.
      if (own) void restoreSession({ silent: true });
      toast.success(`${updated.name} permissions saved.`, own ? { description: 'Your own access has been updated.' } : { description: 'Admins with this role get the new access on their next request.' });
    } catch (e) {
      const errs = handleFormError(e, 'Couldn’t save role', { fields: ['name'] });
      if (errs.name) setNameError(errs.name);
    } finally {
      setSaving(false);
    }
  };

  const create = async (input: RoleInput): Promise<true | FieldErrors | false> => {
    try {
      const role = await roleService.create(input);
      await reload(true);
      setFilter('role', role.id);
      toast.success(`${role.name} role created.`, { description: 'Review its permissions, then assign it to admins.' });
      return true;
    } catch (e) {
      const errs = handleFormError(e, 'Couldn’t create role', { fields: ['name'] });
      return Object.keys(errs).length ? errs : false;
    }
  };

  const remove = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: `Delete ${selected.name}?`,
      description: selected.userCount ? `${selected.userCount} admin${selected.userCount === 1 ? ' uses' : 's use'} this role. Reassign them first, then delete it.` : 'This role will be removed permanently. This action cannot be undone.',
      confirmLabel: 'Delete role',
    });
    if (!ok) return;
    try {
      await roleService.remove(selected.id);
      setFilter('role', '');
      await reload(true);
      toast.success(`${selected.name} role deleted.`);
    } catch (e) {
      toast.error('Couldn’t delete role', { description: errorMessage(e) });
    }
  };

  const granted = draft?.permissions.length ?? 0;

  return (
    <SettingsLayout
      title="Roles & permissions"
      description="Control exactly what each team member can see and do. Changes apply the next time an admin loads a page."
      actions={
        canEdit && (
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            Create role
          </Button>
        )
      }
    >
      {!canEdit && <ReadOnlyBanner />}
      {error ? (
        <div className="panel">
          <ErrorState onRetry={() => void reload()} description={error.message || 'We couldn’t load roles. Please try again.'} />
        </div>
      ) : loading || !roles ? (
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]" aria-busy="true" aria-label="Loading roles">
          <SkeletonPanel rows={6} />
          <div className="space-y-5">
            <Skeleton className="h-36 rounded-xl" />
            <SkeletonPanel rows={10} />
          </div>
        </div>
      ) : !selected || !draft ? (
        <div className="panel">
          <EmptyState icon={ShieldCheck} title="No roles yet" description="Create a role to start granting access." />
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <RoleList roles={roles} selectedId={selected.id} onSelect={(r) => void select(r)} />

          <div className="min-w-0 space-y-5">
            <section className="panel" aria-labelledby="role-detail-title">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="role-detail-title" className="text-lg font-semibold tracking-tight text-zinc-950">
                      {draft.name || 'Untitled role'}
                    </h2>
                    {selected.isSystem && <Badge tone="muted">System role</Badge>}
                    {locked && (
                      <Badge tone="brand">
                        <span className="inline-flex items-center gap-1">
                          <Lock size={10} aria-hidden /> Locked
                        </span>
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                    <Link to={`/settings/admin-users?role=${selected.id}`} className="inline-flex items-center gap-1 font-medium text-zinc-700 hover:text-zinc-950 hover:underline">
                      <Users size={12} aria-hidden /> {selected.userCount} {selected.userCount === 1 ? 'admin' : 'admins'}
                    </Link>
                    <span>Updated {formatDate(selected.updatedAt)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-display text-2xl font-bold leading-none tabular text-zinc-950">
                      {granted}
                      <span className="text-base font-semibold text-zinc-400">/{ALL_PERMISSIONS.length}</span>
                    </p>
                    <p className="mt-1 text-2xs font-semibold uppercase tracking-wider text-zinc-500">Permissions granted</p>
                  </div>
                  {canEdit && !selected.isSystem && !locked && (
                    <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => void remove()}>
                      Delete
                    </Button>
                  )}
                </div>
              </header>
              <div className="px-5 py-4">
                <FormGrid>
                  <Input
                    label="Role name"
                    required
                    value={draft.name}
                    onChange={(e) => {
                      setDraft({ ...draft, name: e.target.value });
                      setNameError(undefined);
                    }}
                    error={nameError}
                    disabled={readOnly || selected.isSystem}
                    help={selected.isSystem ? 'System role names are fixed.' : undefined}
                    maxLength={50}
                  />
                  <Textarea label="Description" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} disabled={readOnly} maxLength={160} />
                </FormGrid>
              </div>
            </section>

            {unknownKeys.length > 0 && (
              <Callout tone="warning" title="The server has permissions this screen doesn’t show">
                {unknownKeys.join(', ')} — update the admin app’s permission list before editing roles, or these grants may be removed on save.
              </Callout>
            )}

            {locked && (
              <Callout icon={Lock} tone="dark" title="Super Admin always has full access">
                This role holds every permission and can’t be edited, so the store can never be locked out. At least one active Super Admin is always required.
              </Callout>
            )}

            <section className="panel overflow-hidden" aria-labelledby="perm-title">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4">
                <div>
                  <h2 id="perm-title" className="panel-title">
                    Permission matrix
                  </h2>
                  <p className="mt-0.5 text-[0.8125rem] text-zinc-500">Granting any action also grants View. Removing View clears the module.</p>
                </div>
                <span className="text-xs text-zinc-500">— means the action doesn’t apply to that module</span>
              </header>
              <PermissionMatrix roleName={draft.name} value={draft.permissions} readOnly={readOnly || saving} onChange={(permissions) => setDraft({ ...draft, permissions })} />
            </section>

            {canEdit && !locked && (
              <SaveBar
                dirty={dirty}
                saving={saving}
                message={`Unsaved changes to ${selected.name}`}
                saveLabel="Save role"
                onSave={() => void save()}
                onDiscard={() => {
                  setDraft(toDraft(selected));
                  setNameError(undefined);
                }}
              />
            )}
          </div>
        </div>
      )}

      <CreateRoleModal open={creating} roles={roles ?? []} onClose={() => setCreating(false)} onCreate={create} />
    </SettingsLayout>
  );
}
