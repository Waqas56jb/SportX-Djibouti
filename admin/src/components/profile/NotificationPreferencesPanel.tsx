import { Link } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { FormSection } from '@/components/forms';
import { usePermission } from '@/hooks/usePermission';

/**
 * Personal notification preferences are not supported by the API yet (there is no per-admin
 * preferences endpoint), so this panel only explains where alerts are configured instead of
 * offering toggles that would not be saved.
 */
export function NotificationPreferencesPanel() {
  const canStoreSettings = usePermission('settings:view');

  return (
    <FormSection id="notifications" title="Notification preferences" description="How you get notified about store events.">
      <div className="flex gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3.5">
        <BellRing size={18} className="mt-0.5 shrink-0 text-zinc-500" aria-hidden />
        <div className="text-[0.8125rem] leading-relaxed text-zinc-600">
          <p className="font-medium text-zinc-900">Personal preferences aren’t available yet</p>
          <p className="mt-0.5">
            Alerts follow the store-wide channel settings for the whole team
            {canStoreSettings ? (
              <>
                {' '}
                in{' '}
                <Link to="/settings/notifications" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
                  Settings › Notifications
                </Link>
                .
              </>
            ) : (
              ', managed by a Super Admin.'
            )}{' '}
            Password reset emails are always sent.
          </p>
        </div>
      </div>
    </FormSection>
  );
}
