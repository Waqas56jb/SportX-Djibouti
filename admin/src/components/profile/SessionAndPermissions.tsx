import { useMemo } from 'react';
import { Check, Minus, Monitor, Smartphone } from 'lucide-react';
import type { AuthSession, PermissionAction } from '@/types';
import { Badge, Panel } from '@/components/common';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from '@/constants/permissions';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';

function describeDevice(): { name: string; mobile: boolean } {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return { name: `${browser} on ${os}`, mobile: /Android|iPhone|iPad/.test(ua) };
}

function SessionRow({ mobile, title, sub, current }: { mobile: boolean; title: string; sub: string; current?: boolean }) {
  const Icon = mobile ? Smartphone : Monitor;
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', current ? 'bg-ink-950 text-volt' : 'bg-zinc-100 text-zinc-500')}>
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900">
          {title}
          {current && <Badge tone="success" dot>This device</Badge>}
        </div>
        <div className="truncate text-xs text-zinc-500">{sub}</div>
      </div>
    </li>
  );
}

/**
 * Current device only: the API has no endpoint to list or revoke individual sessions. Changing the
 * password signs out every other device; an admin with settings access can reset someone's access.
 */
export function SessionsPanel({ session }: { session: AuthSession }) {
  const device = useMemo(describeDevice, []);
  return (
    <Panel title="Sessions" description="Where you are signed in right now.">
      <ul className="-my-3 divide-y divide-zinc-100">
        <SessionRow current mobile={device.mobile} title={device.name} sub={session.expiresAt ? `Active now · access token renews automatically (current one expires ${formatDateTime(session.expiresAt)})` : 'Active now'} />
      </ul>
      <p className="mt-4 text-xs text-zinc-500">
        To sign out of every other device, <a href="#password" className="font-medium text-zinc-700 underline-offset-2 hover:underline">change your password</a>. Other active sessions aren’t listed here.
      </p>
    </Panel>
  );
}

export function PermissionsSummary({ session }: { session: AuthSession }) {
  const granted = new Set(session.role.permissions);
  const modules = PERMISSION_MODULES.map((m) => ({ ...m, has: m.actions.filter((a) => granted.has(`${m.module}:${a}`)) }));
  const accessible = modules.filter((m) => m.has.length);
  const label = (a: PermissionAction) => PERMISSION_ACTIONS.find((x) => x.action === a)?.label ?? a;

  return (
    <Panel title="Your access" description={`${session.role.name} · ${accessible.length} of ${modules.length} modules`}>
      <p className="-mt-1 mb-4 text-[0.8125rem] text-zinc-500">{session.role.description}</p>
      <ul className="space-y-2.5">
        {modules.map((m) => {
          const full = m.has.length === m.actions.length;
          return (
            <li key={m.module} className={cn('flex items-start gap-2.5', !m.has.length && 'opacity-55')}>
              <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full', m.has.length ? 'bg-ink-950 text-volt' : 'bg-zinc-100 text-zinc-400')}>
                {m.has.length ? <Check size={11} strokeWidth={3} aria-hidden /> : <Minus size={11} strokeWidth={3} aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.8125rem] font-medium text-zinc-900">{m.label}</span>
                  <span className="text-2xs font-medium text-zinc-400">{!m.has.length ? 'No access' : full ? 'Full access' : `${m.has.length}/${m.actions.length}`}</span>
                </div>
                {m.has.length > 0 && !full && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.has.map((a) => (
                      <span key={a} className="rounded bg-zinc-100 px-1.5 py-0.5 text-2xs font-medium text-zinc-600">
                        {label(a)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 border-t border-zinc-100 pt-4 text-xs text-zinc-500">Need more access? Ask a Super Admin to update your role.</p>
    </Panel>
  );
}
