import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Mail } from 'lucide-react';
import { Button } from '@/components/common';
import { FormSection, Toggle } from '@/components/forms';
import { usePermission } from '@/hooks/usePermission';
import { toast } from '@/store/toastStore';

type Channel = 'email' | 'inApp';
interface Pref {
  id: string;
  label: string;
  description: string;
  email: boolean;
  inApp: boolean;
  locked?: Channel[];
}

const DEFAULTS: Pref[] = [
  { id: 'new_order', label: 'New orders', description: 'An order is placed or paid.', email: false, inApp: true },
  { id: 'low_stock', label: 'Low stock', description: 'A variant drops below its threshold.', email: true, inApp: true },
  { id: 'refund_requested', label: 'Refund requests', description: 'A customer asks for a refund or return.', email: true, inApp: true },
  { id: 'review_pending', label: 'Reviews to moderate', description: 'A new product review awaits approval.', email: false, inApp: true },
  { id: 'new_ticket', label: 'Support tickets', description: 'A ticket is opened or assigned to you.', email: true, inApp: true },
  { id: 'digest', label: 'Weekly performance digest', description: 'Monday summary of sales, top products and stock.', email: true, inApp: false },
  { id: 'security', label: 'Security alerts', description: 'Sign-ins from a new device and password changes.', email: true, inApp: true, locked: ['email'] },
];

/** Personal notification channels for the signed-in admin (separate from store-wide channel settings). */
export function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<Pref[]>(DEFAULTS);
  const [saved, setSaved] = useState<Pref[]>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const canStoreSettings = usePermission('settings:view');
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);

  const set = (id: string, ch: Channel, v: boolean) => setPrefs((list) => list.map((p) => (p.id === id ? { ...p, [ch]: v } : p)));

  const save = async () => {
    setSaving(true);
    // Frontend phase: personal preferences are kept locally. API: PUT /auth/me/notification-preferences
    await new Promise((r) => setTimeout(r, 400));
    setSaved(prefs);
    setSaving(false);
    toast.success('Preferences saved.');
  };

  return (
    <FormSection
      id="notifications"
      title="Notification preferences"
      description={
        <>
          How <strong className="font-medium text-zinc-700">you</strong> personally get notified. Store-wide channels are managed
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
            ' by a Super Admin.'
          )}
        </>
      }
    >
      <div className="-mx-5 sm:-mx-6">
        <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b border-zinc-100 px-5 pb-2 text-2xs font-semibold uppercase tracking-wider text-zinc-400 sm:px-6">
          <span>Event</span>
          <span className="flex items-center justify-center gap-1">
            <Mail size={12} aria-hidden /> Email
          </span>
          <span className="flex items-center justify-center gap-1">
            <Bell size={12} aria-hidden /> In-app
          </span>
        </div>
        <ul className="divide-y divide-zinc-100">
          {prefs.map((p) => (
            <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 px-5 py-3 sm:px-6">
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-900">{p.label}</div>
                <div className="text-xs text-zinc-500">{p.description}</div>
              </div>
              {(['email', 'inApp'] as Channel[]).map((ch) => (
                <label key={ch} className="flex justify-center" title={p.locked?.includes(ch) ? 'Required for account security' : undefined}>
                  <span className="sr-only">
                    {p.label} by {ch === 'email' ? 'email' : 'in-app notification'}
                  </span>
                  <Toggle size="sm" checked={p[ch]} disabled={p.locked?.includes(ch)} onChange={(v) => set(p.id, ch, v)} />
                </label>
              ))}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => setPrefs(saved)}>
          Discard
        </Button>
        <Button variant="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>
          Save preferences
        </Button>
      </div>
    </FormSection>
  );
}
