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
import { errorMessage } from '@/components/settings/formErrors';

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
      toast.error('Couldn’t save notification settings', { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout title="Notifications" description="Choose how the SPORTX team is alerted about orders, payments, stock and customers.">
      {!canEdit && <ReadOnlyBanner />}
      {error ? (
        <div className="panel">
          <ErrorState onRetry={() => void reload()} description={error.message || 'We couldn’t load notification settings. Please try again.'} />
        </div>
      ) : loading || !draft ? (
        <SkeletonPanel rows={10} />
      ) : (
        <>
          <Panel flush title="Alert channels" description="Tick a channel to deliver that event through it. Column checkboxes toggle a channel for every event.">
            <NotificationMatrix prefs={draft} onChange={setDraft} disabled={!canEdit || saving} />
          </Panel>

          <Callout icon={Server} tone="neutral" className="mt-5" title="Saved as store-wide preferences">
            These choices are stored on the server for the whole team. Automatic email and SMS alerts are not sent yet — the API does not read these preferences when events happen, and no SMS provider is connected.
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
