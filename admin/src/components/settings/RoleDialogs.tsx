import { useEffect, useState } from 'react';
import { Lock, ShieldCheck, Users } from 'lucide-react';
import type { Role } from '@/types';
import type { RoleInput } from '@/services/roleService';
import type { FieldErrors } from './formErrors';
import { cn } from '@/utils/cn';
import { ALL_PERMISSIONS } from '@/constants/permissions';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/modals/Overlay';
import { Input, Select, Textarea } from '@/components/forms/Inputs';
import { compact, required } from '@/utils/validation';

/** Selectable list of roles with user counts. */
export function RoleList({ roles, selectedId, onSelect }: { roles: Role[]; selectedId?: string; onSelect: (r: Role) => void }) {
  return (
    <nav aria-label="Roles" className="panel overflow-hidden">
      <p className="eyebrow border-b border-zinc-100 px-4 py-3">{roles.length} roles</p>
      <ul className="max-h-[70vh] divide-y divide-zinc-100 overflow-y-auto scrollbar-thin">
        {roles.map((r) => {
          const active = r.id === selectedId;
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(r)}
                className={cn('relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors', active ? 'bg-zinc-50' : 'hover:bg-zinc-50/70')}
              >
                {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-ink-950" aria-hidden />}
                <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', r.slug === 'super_admin' ? 'bg-ink-950 text-volt' : active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500')}>
                  {r.slug === 'super_admin' ? <Lock size={15} aria-hidden /> : <ShieldCheck size={15} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-zinc-900">{r.name}</span>
                    {r.isSystem && <Badge tone="muted">System</Badge>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1 tabular">
                      <Users size={12} aria-hidden /> {r.userCount} {r.userCount === 1 ? 'admin' : 'admins'}
                    </span>
                    <span className="tabular">
                      {r.permissions.length}/{ALL_PERMISSIONS.length} permissions
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function CreateRoleModal({ open, roles, onClose, onCreate }: { open: boolean; roles: Role[]; onClose: () => void; onCreate: (input: RoleInput) => Promise<boolean | FieldErrors> }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setCopyFrom('');
    setErrors({});
  }, [open]);

  const source = roles.find((r) => r.id === copyFrom);

  const submit = async () => {
    const errs = compact({
      name: required(name, 'Role name') ?? (roles.some((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase()) ? 'A role with this name already exists.' : undefined),
    });
    setErrors(errs);
    if (errs.name) return;
    setSaving(true);
    const res = await onCreate({ name: name.trim(), description: description.trim(), permissions: source ? [...source.permissions] : ['dashboard:view'] });
    setSaving(false);
    if (res === true) onClose();
    else if (res) setErrors({ name: res.name });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title="Create role"
      description="Define a reusable set of permissions, then assign it to admins."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            Create role
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input label="Role name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Warehouse Staff" data-autofocus maxLength={50} />
        <Textarea label="Description" optional rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} showCount placeholder="What is this role responsible for?" />
        <Select
          label="Copy permissions from"
          optional
          placeholder="Start with dashboard access only"
          options={roles.map((r) => ({ value: r.id, label: `${r.name} (${r.permissions.length} permissions)` }))}
          value={copyFrom}
          onChange={(e) => setCopyFrom(e.target.value)}
          help={source ? `Starts with ${source.name}’s ${source.permissions.length} permissions — adjust them after creating.` : 'You can fine-tune every permission after the role is created.'}
        />
      </form>
    </Modal>
  );
}
