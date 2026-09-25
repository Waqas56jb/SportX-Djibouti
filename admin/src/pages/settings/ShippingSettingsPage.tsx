import { useState } from 'react';
import { Map as MapIcon, Plus, PlugZap } from 'lucide-react';
import type { ShippingMethod, ShippingMethodInput, ShippingZone } from '@/types';
import { settingsService } from '@/services/settingsService';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState, SkeletonPanel } from '@/components/common/States';
import { Callout, ReadOnlyBanner, SettingsLayout, StatTile, useCanEditSettings } from '@/components/settings/SettingsKit';
import { ShippingZoneCard } from '@/components/settings/ShippingZoneCard';
import { MethodDrawer, ZoneModal, type ZoneInput } from '@/components/settings/ShippingDialogs';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : undefined);

export default function ShippingSettingsPage() {
  const canEdit = useCanEditSettings();
  const { data: zones, loading, error, reload } = useAsync(() => settingsService.getShippingZones(), []);
  const [zoneModal, setZoneModal] = useState<{ open: boolean; zone?: ShippingZone }>({ open: false });
  const [methodDrawer, setMethodDrawer] = useState<{ open: boolean; zoneId: string; method?: ShippingMethod }>({ open: false, zoneId: '' });

  const refresh = () => reload(true);

  const run = async (fn: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await fn();
      toast.success(success);
      await refresh();
      return true;
    } catch (e) {
      toast.error(failure, { description: errMsg(e) });
      return false;
    }
  };

  const submitZone = (input: ZoneInput) =>
    zoneModal.zone
      ? run(() => settingsService.updateZone(zoneModal.zone!.id, input), 'Shipping zone updated.', 'Couldn’t update zone')
      : run(() => settingsService.createZone(input), 'Shipping zone created.', 'Couldn’t create zone');

  const submitMethod = (input: ShippingMethodInput) =>
    methodDrawer.method
      ? run(() => settingsService.updateMethod(methodDrawer.method!.id, input), 'Shipping method updated.', 'Couldn’t update method')
      : run(() => settingsService.createMethod(input), 'Shipping method created.', 'Couldn’t create method');

  const toggleZone = (z: ShippingZone, enabled: boolean) =>
    run(() => settingsService.updateZone(z.id, { enabled }), enabled ? `${z.name} enabled.` : `${z.name} disabled — hidden at checkout.`, 'Couldn’t update zone');

  const toggleMethod = (m: ShippingMethod, enabled: boolean) => {
    const { id: _id, ...input } = m;
    return run(() => settingsService.updateMethod(m.id, { ...input, enabled }), enabled ? `${m.name} enabled.` : `${m.name} disabled.`, 'Couldn’t update method');
  };

  const deleteZone = async (z: ShippingZone) => {
    const ok = await confirm({
      title: `Delete ${z.name}?`,
      description: `The zone and its ${z.methods.length} delivery method${z.methods.length === 1 ? '' : 's'} will be removed. Customers in ${z.regions.join(', ')} won’t be able to check out until another zone covers them.`,
      confirmLabel: 'Delete zone',
    });
    if (ok) await run(() => settingsService.deleteZone(z.id), 'Shipping zone deleted.', 'Couldn’t delete zone');
  };

  const deleteMethod = async (m: ShippingMethod) => {
    const ok = await confirm({ title: `Delete ${m.name}?`, description: 'Customers will no longer see this option at checkout. Existing orders are not affected.', confirmLabel: 'Delete method' });
    if (ok) await run(() => settingsService.deleteMethod(m.id), 'Shipping method deleted.', 'Couldn’t delete method');
  };

  const list = zones ?? [];
  const methods = list.flatMap((z) => z.methods);
  const regions = list.filter((z) => z.enabled).reduce((n, z) => n + z.regions.length, 0);

  return (
    <SettingsLayout
      title="Shipping"
      description="Delivery zones, prices and timings customers see at checkout."
      actions={
        canEdit && (
          <Button variant="primary" icon={Plus} onClick={() => setZoneModal({ open: true })}>
            Add zone
          </Button>
        )
      }
    >
      {!canEdit && <ReadOnlyBanner />}

      {error ? (
        <div className="panel">
          <ErrorState onRetry={() => void reload()} description="We couldn’t load shipping zones. Please try again." />
        </div>
      ) : loading ? (
        <div className="space-y-5" aria-busy="true" aria-label="Loading shipping zones">
          <SkeletonPanel rows={5} />
          <SkeletonPanel rows={4} />
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Zones" value={list.length} hint={`${list.filter((z) => z.enabled).length} active`} />
            <StatTile label="Regions covered" value={regions} hint="In active zones" />
            <StatTile label="Methods" value={methods.length} hint={`${methods.filter((m) => m.enabled).length} live at checkout`} />
            <StatTile label="Free-shipping offers" value={methods.filter((m) => m.enabled && (m.price === 0 || m.freeShippingThreshold)).length} hint="Free or with threshold" />
          </div>

          {list.length === 0 ? (
            <div className="panel">
              <EmptyState icon={MapIcon} title="No shipping zones" description="Create a zone for Djibouti City to start accepting delivery orders." action={canEdit ? <Button variant="primary" icon={Plus} onClick={() => setZoneModal({ open: true })}>Add zone</Button> : undefined} />
            </div>
          ) : (
            <div className="space-y-5">
              {list.map((z) => (
                <ShippingZoneCard
                  key={z.id}
                  zone={z}
                  canEdit={canEdit}
                  onToggleZone={(v) => void toggleZone(z, v)}
                  onEditZone={() => setZoneModal({ open: true, zone: z })}
                  onDeleteZone={() => void deleteZone(z)}
                  onAddMethod={() => setMethodDrawer({ open: true, zoneId: z.id })}
                  onEditMethod={(m) => setMethodDrawer({ open: true, zoneId: z.id, method: m })}
                  onDeleteMethod={(m) => void deleteMethod(m)}
                  onToggleMethod={(m, v) => void toggleMethod(m, v)}
                />
              ))}
            </div>
          )}

          <Callout icon={PlugZap} tone="neutral" className="mt-6" title="Carrier integrations arrive with the backend">
            Rates here are flat prices set by SPORTX. Live carrier quotes, label printing and tracking webhooks will be connected when the Node.js API is in place.
          </Callout>
        </>
      )}

      <ZoneModal open={zoneModal.open} zone={zoneModal.zone} onClose={() => setZoneModal({ open: false })} onSubmit={submitZone} />
      <MethodDrawer open={methodDrawer.open} zones={list} zoneId={methodDrawer.zoneId} method={methodDrawer.method} onClose={() => setMethodDrawer((s) => ({ ...s, open: false }))} onSubmit={submitMethod} />
    </SettingsLayout>
  );
}
