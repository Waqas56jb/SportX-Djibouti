import { Home, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AccountSection } from '@/components/account/AccountLayout';
import { AddressForm } from '@/components/account/AddressForm';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, SkeletonLoader } from '@/components/common';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useT } from '@/i18n';
import { addressService } from '@/services/addressService';
import { friendlyError } from '@/services/authService';
import { toast } from '@/store/toastStore';
import type { Address, AddressInput } from '@/types';
import { cn } from '@/utils/cn';

export default function AddressesPage() {
  const { t } = useT();
  usePageMeta({ title: t('account.addresses.title'), noindex: true });
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
      toast.error(t('common.states.error'), { description: friendlyError(err) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (input: AddressInput) => {
    const ok =
      editing === 'new'
        ? await run(() => addressService.create(userId, input), t('account.addresses.added'))
        : editing
          ? await run(() => addressService.update(userId, editing.id, input), t('account.addresses.updated'))
          : false;
    if (ok) setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await run(() => addressService.remove(userId, deleting.id), t('account.addresses.deleted'));
    if (ok) setDeleting(null);
  };

  const addresses = data ?? [];

  return (
    <AccountSection
      title={t('account.addresses.title')}
      description={t('account.addresses.description')}
      action={
        addresses.length > 0 && (
          <Button variant="primary" onClick={() => setEditing('new')} leftIcon={<Plus className="h-4 w-4" />}>
            {t('account.addresses.add')}
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
            title={t('account.addresses.emptyTitle')}
            description={t('account.addresses.emptyBody')}
            action={
              <Button onClick={() => setEditing('new')} leftIcon={<Plus className="h-4 w-4" />}>
                {t('account.addresses.add')}
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className={cn('flex flex-col border bg-white p-5 sm:p-6', a.isDefault ? 'border-ink' : 'border-paper-200')}>
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 break-words font-display text-xl font-bold uppercase">
                  <Home className="h-4 w-4 shrink-0" aria-hidden /> {a.label}
                </p>
                {a.isDefault && <Badge tone="dark">{t('account.addresses.default')}</Badge>}
              </div>
              <address className="mt-4 flex-1 text-sm not-italic leading-relaxed text-ink-600">
                <span className="block font-medium text-ink">
                  {a.firstName} {a.lastName}
                </span>
                <span className="block">{a.line1}</span>
                {a.line2 && <span className="block">{a.line2}</span>}
                {a.district && <span className="block">{a.district}</span>}
                <span className="block">
                  {a.city}
                  {a.postalCode ? `, ${a.postalCode}` : ''}, {a.country}
                </span>
                <span className="ltr-text block">{a.phone}</span>
              </address>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-paper-200 pt-4">
                <Button variant="ghost" size="sm" onClick={() => setEditing(a)} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                  {t('common.actions.edit')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(a)} leftIcon={<Trash2 className="h-3.5 w-3.5" />} className="hover:text-danger">
                  {t('common.actions.delete')}
                </Button>
                {!a.isDefault && (
                  <Button variant="link" size="sm" className="ms-auto" disabled={busy} onClick={() => run(() => addressService.setDefault(userId, a.id), t('account.addresses.nowDefault', { label: a.label }))}>
                    {t('account.addresses.setDefault')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => !busy && setEditing(null)} title={editing === 'new' ? t('account.addresses.add') : t('account.addresses.edit')} size="lg">
        {editing !== null && <AddressForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : editing} onSubmit={save} onCancel={() => setEditing(null)} saving={busy} />}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={t('account.addresses.deleteTitle')}
        description={t('account.addresses.deleteBody', { label: deleting?.label ?? '' })}
        confirmLabel={t('common.actions.delete')}
        destructive
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </AccountSection>
  );
}
