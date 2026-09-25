import { useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, KeyRound, Landmark, Lock, Smartphone, type LucideIcon } from 'lucide-react';
import type { PaymentProvider, PaymentProviderField, PaymentProviderId } from '@/types';
import { cn } from '@/utils/cn';
import { isUrl } from '@/utils/validation';
import { confirm } from '@/store/confirmStore';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Segmented } from '@/components/common/Tabs';
import { Toggle } from '@/components/forms/Choice';
import { Field, controlClass } from '@/components/forms/Field';
import { Input } from '@/components/forms/Inputs';

const ICONS: Record<PaymentProviderId, LucideIcon> = { stripe: CreditCard, mobile_money: Smartphone, cash_on_delivery: Banknote, bank_transfer: Landmark };

/** Name of the server environment variable that holds a secret credential. */
export function secretEnvVar(providerId: PaymentProviderId, f: PaymentProviderField): string {
  const fromHelp = f.help?.match(/\(([A-Z][A-Z0-9_]+)\)/)?.[1];
  if (fromHelp) return fromHelp;
  return `${providerId.toUpperCase()}_${f.key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}`;
}

export interface ProviderPatch {
  enabled: boolean;
  mode: 'test' | 'live';
  fields: Record<string, string>;
}

function validateField(f: PaymentProviderField, v: string): string | undefined {
  const value = v.trim();
  if (!value) return undefined;
  if (/url/i.test(f.key) && !(isUrl(value) && value.startsWith('https://'))) return 'Use a full https:// URL.';
  if (/^max/i.test(f.key) && !/^\d+(\.\d+)?$/.test(value)) return 'Enter a number without separators.';
  if (f.key === 'publishableKey' && !/^pk_(test|live)_/.test(value)) return 'Publishable keys start with pk_test_ or pk_live_.';
  return undefined;
}

export function PaymentProviderCard({ provider, canEdit, onSave }: { provider: PaymentProvider; canEdit: boolean; onSave: (patch: ProviderPatch) => Promise<boolean> }) {
  const initial = useMemo<ProviderPatch>(
    () => ({ enabled: provider.enabled, mode: provider.mode, fields: Object.fromEntries(provider.fields.filter((f) => !f.secret).map((f) => [f.key, f.value])) }),
    [provider],
  );
  const [draft, setDraft] = useState<ProviderPatch>(initial);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(initial), [initial]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const Icon = ICONS[provider.id] ?? KeyRound;
  const ro = !canEdit || saving;

  const setMode = async (mode: 'test' | 'live') => {
    if (mode === draft.mode) return;
    if (mode === 'live') {
      const ok = await confirm({
        title: `Switch ${provider.name} to live mode?`,
        description: 'Live mode processes real customer payments using the production credentials configured on the server. Make sure checkout has been tested end-to-end first. The change applies when you save.',
        confirmLabel: 'Switch to live',
      });
      if (!ok) return;
    }
    setDraft((d) => ({ ...d, mode }));
  };

  const save = async () => {
    const errs: Record<string, string | undefined> = {};
    for (const f of provider.fields) if (!f.secret) errs[f.key] = validateField(f, draft.fields[f.key] ?? '');
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  return (
    <article className={cn('panel flex flex-col', dirty && 'ring-1 ring-ink-950/80')} aria-labelledby={`pay-${provider.id}`}>
      <header className="flex items-start gap-3.5 border-b border-zinc-100 px-5 py-4">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', draft.enabled ? 'border-ink-950 bg-ink-950 text-volt' : 'border-zinc-200 bg-zinc-50 text-zinc-400')}>
          <Icon size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`pay-${provider.id}`} className="panel-title">
              {provider.name}
            </h2>
            {provider.configured ? (
              <Badge tone="success" dot>
                Configured
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Needs setup
              </Badge>
            )}
            {draft.mode === 'live' ? <Badge tone="brand">Live</Badge> : <Badge tone="info">Test mode</Badge>}
          </div>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-zinc-500">{provider.description}</p>
        </div>
        <Toggle label={`Enable ${provider.name}`} checked={draft.enabled} onChange={(v) => setDraft((d) => ({ ...d, enabled: v }))} disabled={ro} className="[&_label]:sr-only" />
      </header>

      <div className="flex-1 space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[0.8125rem] font-medium text-zinc-800">Environment</span>
          {ro ? (
            <span className="text-[0.8125rem] font-medium text-zinc-600">{draft.mode === 'live' ? 'Live' : 'Test'}</span>
          ) : (
            <Segmented
              ariaLabel={`${provider.name} mode`}
              value={draft.mode}
              onChange={(m) => void setMode(m)}
              options={[
                { value: 'test', label: 'Test' },
                { value: 'live', label: 'Live' },
              ]}
            />
          )}
        </div>

        {provider.fields.map((f) =>
          f.secret ? (
            <Field
              key={f.key}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Lock size={12} className="text-zinc-400" aria-hidden /> {f.label}
                </span>
              }
              aside={f.value ? <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><CheckCircle2 size={12} aria-hidden /> Set on server</span> : <span className="font-medium text-amber-700">Not set</span>}
              help={
                <>
                  Server-only. Set the <code className="rounded bg-zinc-100 px-1 py-px font-mono text-[0.6875rem] text-zinc-800">{secretEnvVar(provider.id, f)}</code> environment variable on the API server.
                </>
              }
            >
              {({ id, describedBy }) => (
                <div className="relative">
                  <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden />
                  <input id={id} aria-describedby={describedBy} readOnly disabled tabIndex={-1} value="" placeholder={f.value ? `Stored on server — never shown (${f.value})` : 'Stored on server — never shown'} autoComplete="off" className={controlClass(false, 'h-9 cursor-not-allowed pl-8 font-mono text-xs')} />
                </div>
              )}
            </Field>
          ) : (
            <Input
              key={f.key}
              label={f.label}
              value={draft.fields[f.key] ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({ ...d, fields: { ...d.fields, [f.key]: v } }));
                if (errors[f.key]) setErrors((x) => ({ ...x, [f.key]: undefined }));
              }}
              placeholder={f.placeholder}
              help={f.help}
              error={errors[f.key]}
              disabled={ro}
              autoComplete="off"
              spellCheck={false}
              inputClassName={/key|id|url/i.test(f.key) ? 'font-mono text-[0.8125rem]' : undefined}
            />
          ),
        )}
      </div>

      {canEdit && (
        <footer className="flex items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <span className="text-xs text-zinc-500">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <div className="flex gap-2">
            {dirty && (
              <Button
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setDraft(initial);
                  setErrors({});
                }}
              >
                Discard
              </Button>
            )}
            <Button size="sm" variant="primary" disabled={!dirty} loading={saving} onClick={() => void save()}>
              Save {provider.name}
            </Button>
          </div>
        </footer>
      )}
    </article>
  );
}
