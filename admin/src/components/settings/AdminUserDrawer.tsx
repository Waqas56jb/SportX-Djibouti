import { useEffect, useState } from 'react';
import { Mail, Phone, Send } from 'lucide-react';
import type { AdminUser, Role } from '@/types';
import type { AdminUserInput } from '@/services/settingsService';
import { Avatar } from '@/components/common/Misc';
import { Button } from '@/components/common/Button';
import { Drawer } from '@/components/modals/Overlay';
import { Input, Select } from '@/components/forms/Inputs';
import { compact, isEmail, isPhone, required } from '@/utils/validation';
import { PERMISSION_MODULES } from '@/constants/permissions';

type Errors = Partial<Record<keyof AdminUserInput, string>>;

/** Invite (create) or edit an admin. `onSubmit` resolves to an error message to show inline, or null on success. */
export function AdminUserDrawer({ open, user, roles, onClose, onSubmit }: { open: boolean; user?: AdminUser; roles: Role[]; onClose: () => void; onSubmit: (input: AdminUserInput) => Promise<string | null> }) {
  const [f, setF] = useState<AdminUserInput>({ name: '', email: '', phone: '', roleId: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(user ? { name: user.name, email: user.email, phone: user.phone ?? '', roleId: user.roleId } : { name: '', email: '', phone: '', roleId: '' });
    setErrors({});
  }, [open, user]);

  const set = <K extends keyof AdminUserInput>(k: K, v: AdminUserInput[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const role = roles.find((r) => r.id === f.roleId);
  const modules = role ? PERMISSION_MODULES.filter((m) => role.permissions.includes(`${m.module}:view`)).map((m) => m.label) : [];

  const submit = async () => {
    const errs: Errors = compact({
      name: required(f.name, 'Full name'),
      email: required(f.email, 'Email') ?? (isEmail(f.email) ? undefined : 'Enter a valid email address.'),
      phone: f.phone?.trim() && !isPhone(f.phone) ? 'Enter a valid phone number.' : undefined,
      roleId: required(f.roleId, 'Role'),
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const err = await onSubmit({ name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone?.trim() || undefined, roleId: f.roleId });
    setSaving(false);
    if (err === null) onClose();
    else if (/super admin/i.test(err)) setErrors({ roleId: err });
    else if (/email/i.test(err)) setErrors({ email: err });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      dismissible={!saving}
      width="md"
      title={user ? 'Edit admin' : 'Add admin'}
      description={user ? 'Update profile details and access level.' : 'An invitation email with a secure sign-up link is sent to this address.'}
      headerExtra={
        user && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
            <Avatar name={user.name} src={user.avatarUrl} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">{user.name}</p>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
            </div>
          </div>
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" icon={user ? undefined : Send} loading={saving} onClick={() => void submit()}>
            {user ? 'Save changes' : 'Send invitation'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input label="Full name" required value={f.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoComplete="off" data-autofocus maxLength={80} />
        <Input label="Work email" type="email" required icon={Mail} value={f.email} onChange={(e) => set('email', e.target.value)} error={errors.email} autoComplete="off" placeholder="name@company" />
        <Input label="Phone" type="tel" optional icon={Phone} value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} error={errors.phone} placeholder="+253 …" />
        <Select label="Role" required placeholder="Select a role…" options={roles.map((r) => ({ value: r.id, label: r.name }))} value={f.roleId} onChange={(e) => set('roleId', e.target.value)} error={errors.roleId} />
        {role && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
            <p className="text-[0.8125rem] font-medium text-zinc-900">{role.name}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{role.description}</p>
            <p className="mt-2 text-xs text-zinc-600">
              <span className="font-medium">Access to:</span> {modules.length ? modules.join(', ') : 'No modules'}
            </p>
          </div>
        )}
      </form>
    </Drawer>
  );
}
