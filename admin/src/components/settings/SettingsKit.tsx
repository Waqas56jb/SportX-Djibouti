import type { ReactNode } from 'react';
import { Info, Lock, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { usePermission } from '@/hooks/usePermission';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { SettingsNav } from './SettingsNav';

/** `settings:edit` gate shared by every settings screen. UX only — the API enforces the same rule. */
export const useCanEditSettings = () => usePermission('settings:edit');

/** Page frame for settings screens: eyebrow + title, the settings sub-navigation, then content. */
export function SettingsLayout({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <PageHeader eyebrow="Settings" title={title} description={description} actions={actions} className="mb-5" />
      <SettingsNav />
      {children}
    </div>
  );
}

type CalloutTone = 'info' | 'neutral' | 'warning' | 'dark';

const CALLOUT: Record<CalloutTone, string> = {
  info: 'border-sky-200/80 bg-sky-50/70 text-sky-900',
  neutral: 'border-zinc-200 bg-white text-zinc-700',
  warning: 'border-amber-200 bg-amber-50/80 text-amber-900',
  dark: 'border-ink-800 bg-ink-950 text-zinc-300',
};

export function Callout({ icon: Icon = Info, title, children, tone = 'info', className, action }: { icon?: LucideIcon; title?: ReactNode; children?: ReactNode; tone?: CalloutTone; className?: string; action?: ReactNode }) {
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3.5', CALLOUT[tone], className)}>
      <Icon size={18} aria-hidden className={cn('mt-0.5 shrink-0', tone === 'dark' ? 'text-volt' : 'opacity-80')} />
      <div className="min-w-0 flex-1 text-[0.8125rem] leading-relaxed">
        {title && <p className={cn('font-semibold', tone === 'dark' ? 'text-white' : '')}>{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', tone === 'dark' ? 'text-zinc-400' : 'opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** Info banner shown to admins who can view settings but not change them. */
export function ReadOnlyBanner({ className }: { className?: string }) {
  return (
    <Callout icon={Lock} tone="neutral" className={cn('mb-5', className)} title="View-only access">
      Your role can view these settings but not change them. Ask a Super Admin for the <span className="font-mono text-xs font-semibold text-zinc-900">settings:edit</span> permission.
    </Callout>
  );
}

/** Sticky bottom bar that appears while a form has unsaved changes. */
export function SaveBar({ dirty, saving, onSave, onDiscard, message = 'You have unsaved changes', saveLabel = 'Save changes', disabled }: { dirty: boolean; saving?: boolean; onSave: () => void; onDiscard: () => void; message?: ReactNode; saveLabel?: string; disabled?: boolean }) {
  if (!dirty && !saving) return null;
  return (
    <div className="sticky bottom-4 z-30 mt-6 animate-toast-in" role="region" aria-label="Unsaved changes">
      <div className="dark-surface flex flex-col gap-3 rounded-xl border border-ink-800 bg-ink-950 px-4 py-3 text-white shadow-pop sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2.5 text-sm font-medium">
          <span className="h-2 w-2 shrink-0 rounded-full bg-volt" aria-hidden />
          {message}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving} className="!text-zinc-300 hover:!bg-white/10 hover:!text-white">
            Discard
          </Button>
          <Button variant="volt" size="sm" onClick={onSave} loading={saving} disabled={disabled}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small uppercase label + value used in summary strips. */
export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="panel px-4 py-3.5">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular text-zinc-950">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

/** Stable JSON comparison for dirty tracking of plain settings objects. */
export const isSame = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
