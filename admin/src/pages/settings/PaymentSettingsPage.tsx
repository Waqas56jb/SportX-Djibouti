import { ShieldCheck } from 'lucide-react';
import type { PaymentProvider } from '@/types';
import { settingsService } from '@/services/settingsService';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/store/toastStore';
import { ErrorState, SkeletonPanel } from '@/components/common/States';
import { Callout, ReadOnlyBanner, SettingsLayout, StatTile, useCanEditSettings } from '@/components/settings/SettingsKit';
import { PaymentProviderCard, type ProviderPatch } from '@/components/settings/PaymentProviderCard';

export default function PaymentSettingsPage() {
  const canEdit = useCanEditSettings();
  const { data, loading, error, reload, setData } = useAsync(() => settingsService.getPaymentProviders(), []);

  const save = async (p: PaymentProvider, patch: ProviderPatch) => {
    try {
      const updated = await settingsService.updatePaymentProvider(p.id, patch);
      setData((list) => list?.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(`${updated.name} settings saved.`, updated.configured ? undefined : { description: 'Some fields are still empty — the provider shows “Needs setup”.' });
      return true;
    } catch (e) {
      toast.error(`Couldn’t save ${p.name}`, { description: e instanceof Error ? e.message : undefined });
      return false;
    }
  };

  const list = data ?? [];
  const enabled = list.filter((p) => p.enabled);

  return (
    <SettingsLayout title="Payments" description="Choose which payment methods customers can use at checkout and manage their public configuration.">
      {!canEdit && <ReadOnlyBanner />}

      <Callout icon={ShieldCheck} tone="dark" className="mb-6" title="Secrets never touch the browser">
        API secret keys, webhook signing secrets and bank account numbers are stored only in the API server’s environment variables. This screen never displays, accepts or transmits them — it shows whether each one is set. Only public settings such as publishable keys, merchant IDs and callback URLs are editable here.
      </Callout>

      {error ? (
        <div className="panel">
          <ErrorState onRetry={() => void reload()} description="We couldn’t load payment providers. Please try again." />
        </div>
      ) : loading ? (
        <div className="grid gap-5 xl:grid-cols-2" aria-busy="true" aria-label="Loading payment providers">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonPanel key={i} rows={5} />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Enabled methods" value={`${enabled.length}/${list.length}`} hint="Offered at checkout" />
            <StatTile label="Configured" value={list.filter((p) => p.configured).length} hint="Public settings complete" />
            <StatTile label="Live" value={enabled.filter((p) => p.mode === 'live').length} hint="Processing real payments" />
            <StatTile label="Needs setup" value={list.filter((p) => !p.configured).length} hint="Missing configuration" />
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-2">
            {list.map((p) => (
              <PaymentProviderCard key={p.id} provider={p} canEdit={canEdit} onSave={(patch) => save(p, patch)} />
            ))}
          </div>
        </>
      )}
    </SettingsLayout>
  );
}
