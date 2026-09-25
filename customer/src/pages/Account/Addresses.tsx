import { Home, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AccountSection } from '@/components/account/AccountLayout';
import { AddressForm } from '@/components/account/AddressForm';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, SkeletonLoader } from '@/components/common';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { addressService, errorMessage } from '@/services';
import { toast } from '@/store/toastStore';
import type { Address, AddressInput } from '@/types';
import { cn } from '@/utils/cn';

export default function AddressesPage() {
  usePageMeta({ title: 'Addresses', noindex: true });
  const { user } = useAuth();
  const userId = user!.id;
  const { data, loading, error, reload, setData } = useAsync(() => addressService.list(userId), [userId]);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<Address[]>, success: string) => {
    setBusy(true);
    try {
      setData(await action());
      toast.success(success);
      return true;
    } catch (err) {
      toast.error('Something went wrong', { description: errorMessage(err) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (input: AddressInput) => {
    const ok =
      editing === 'new'
        ? await run(() => addressService.create(userId, input), 'Address added')
        : editing
          ? await run(() => addressService.update(userId, editing.id, input), 'Address updated')
          : false;
    if (ok) setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await run(() => addressService.remove(userId, deleting.id), 'Address deleted');
    if (ok) setDeleting(null);
  };

  const addresses = data ?? [];

  return (
    <AccountSection
      title="Addresses"
      description="Manage where your orders are delivered."
      action={
        addresses.length > 0 && (
          <Button variant="primary" onClick={() => setEditing('new')} leftIcon={<Plus className="h-4 w-4" />}>
            Add address
          </Button>
        )
      }
    >
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <SkeletonLoader rows={2} />
      ) : addresses.length === 0 ? (
        <div className="border border-paper-200 bg-white">
          <EmptyState
            compact
            icon={<MapPin />}
            title="No saved addresses"
            description="Save an address for faster checkout."
            action={
              <Button onClick={() => setEditing('new')} leftIcon={<Plus className="h-4 w-4" />}>
                Add address
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className={cn('flex flex-col border bg-white p-5 sm:p-6', a.isDefault ? 'border-ink' : 'border-paper-200')}>
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 font-display text-xl font-bold uppercase">
                  <Home className="h-4 w-4" aria-hidden /> {a.label}
                </p>
                {a.isDefault && <Badge tone="dark">Default</Badge>}
              </div>
              <address className="mt-4 flex-1 text-sm not-italic leading-relaxed text-ink-600">
                <span className="block font-medium text-ink">
                  {a.firstName} {a.lastName}
                </span>
                <span className="block">{a.line1}</span>
                {a.line2 && <span className="block">{a.line2}</span>}
                <span className="block">
                  {a.city}
                  {a.postalCode ? `, ${a.postalCode}` : ''}, {a.country}
                </span>
                <span className="block">{a.phone}</span>
              </address>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-paper-200 pt-4">
                <Button variant="ghost" size="sm" onClick={() => setEditing(a)} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(a)} leftIcon={<Trash2 className="h-3.5 w-3.5" />} className="hover:text-danger">
                  Delete
                </Button>
                {!a.isDefault && (
                  <Button variant="link" size="sm" className="ml-auto" disabled={busy} onClick={() => run(() => addressService.setDefault(userId, a.id), `${a.label} is now your default address`)}>
                    Set as default
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => !busy && setEditing(null)} title={editing === 'new' ? 'Add address' : 'Edit address'} size="lg">
        {editing !== null && <AddressForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : editing} onSubmit={save} onCancel={() => setEditing(null)} saving={busy} />}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete address?"
        description={`“${deleting?.label ?? ''}” will be removed from your saved addresses. This can’t be undone.`}
        confirmLabel="Delete"
        destructive
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </AccountSection>
  );
}
