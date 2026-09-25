import { useEffect, useMemo, useState } from 'react';
import { Server } from 'lucide-react';
import type { NotificationPreference } from '@/types';
import { settingsService } from '@/services/settingsService';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/store/toastStore';
import { Panel } from '@/components/common/Panel';
import { ErrorState, SkeletonPanel } from '@/components/common/States';
import { Callout, isSame, ReadOnlyBanner, SaveBar, SettingsLayout, useCanEditSettings } from '@/components/settings/SettingsKit';
import { CHANNELS, NotificationMatrix } from '@/components/settings/NotificationMatrix';

export default function NotificationSettingsPage() {
  const canEdit = useCanEditSettings();
  const { data, loading, error, reload, setData } = useAsync(() => settingsService.getNotificationPreferences(), []);
  const [draft, setDraft] = useState<NotificationPreference[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const dirty = useMemo(() => Boolean(draft && data && !isSame(draft, data)), [draft, data]);
  const changed = useMemo(() => {
    if (!draft || !data) return 0;
    let n = 0;
    draft.forEach((p, i) => CHANNELS.forEach((c) => (p.channels[c.id] !== data[i]?.channels[c.id] ? n++ : null)));
    return n;
  }, [draft, data]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await settingsService.updateNotificationPreferences(draft);
      setData(saved);
      setDraft(saved);
      toast.success('Notification settings saved.');
    } catch (e) {
      toast.error('Couldn’t save notification settings', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout title="Notifications" description="Choose how the SPORTX team is alerted about orders, payments, stock and customers.">
      {!canEdit && <ReadOnlyBanner />}
      {error ? (
        <div className="panel">
          <ErrorState onRetry={() => void reload()} description="We couldn’t load notification settings. Please try again." />
        </div>
      ) : loading || !draft ? (
        <SkeletonPanel rows={10} />
      ) : (
        <>
          <Panel flush title="Alert channels" description="Tick a channel to deliver that event through it. Column checkboxes toggle a channel for every event.">
            <NotificationMatrix prefs={draft} onChange={setDraft} disabled={!canEdit || saving} />
          </Panel>

          <Callout icon={Server} tone="neutral" className="mt-5" title="Delivery is handled by the backend">
            These preferences are stored now; email and SMS delivery start once the API’s mail and SMS providers are connected. Recipients are resolved from each admin’s role permissions at send time.
          </Callout>

          {canEdit && (
            <SaveBar
              dirty={dirty}
              saving={saving}
              message={`${changed} unsaved change${changed === 1 ? '' : 's'}`}
              onSave={() => void save()}
              onDiscard={() => data && setDraft(data)}
            />
          )}
        </>
      )}
    </SettingsLayout>
  );
}
