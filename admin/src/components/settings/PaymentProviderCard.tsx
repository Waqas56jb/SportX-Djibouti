import { useState } from 'react';
import { Banknote, CheckCircle2, Copy, CreditCard, FlaskConical, KeyRound, Lock, Webhook, XCircle, type LucideIcon } from 'lucide-react';
import type { PaymentProviderStatus } from '@/types';
import { cn } from '@/utils/cn';
import { toast } from '@/store/toastStore';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';

const ICONS: Record<string, LucideIcon> = { stripe: CreditCard, cash_on_delivery: Banknote, mock: FlaskConical };

const METHOD_LABEL: Record<string, string> = { CARD: 'Card', CASH_ON_DELIVERY: 'Cash on delivery', MOBILE_MONEY: 'Mobile money', BANK_TRANSFER: 'Bank transfer' };
const methodLabel = (m: string) => METHOD_LABEL[m] ?? m.charAt(0) + m.slice(1).toLowerCase().replace(/_/g, ' ');

/**
 * Read-only status of one payment provider. Keys and secrets are configured in the API server's
 * environment; this card only shows whether each variable is present — it never renders an input.
 */
export function PaymentProviderCard({ provider }: { provider: PaymentProviderStatus }) {
  const Icon = ICONS[provider.id] ?? KeyRound;
  const [copied, setCopied] = useState(false);

  const copyWebhook = async () => {
    if (!provider.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(provider.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Couldn’t copy the URL', { description: 'Select it and copy it manually.' });
    }
  };

  return (
    <article className="panel flex flex-col" aria-labelledby={`pay-${provider.id}`}>
      <header className="flex items-start gap-3.5 border-b border-zinc-100 px-5 py-4">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', provider.enabled ? 'border-ink-950 bg-ink-950 text-volt' : 'border-zinc-200 bg-zinc-50 text-zinc-400')}>
          <Icon size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`pay-${provider.id}`} className="panel-title">
              {provider.name}
            </h2>
            {provider.enabled ? (
              <Badge tone="success" dot>
                Enabled
              </Badge>
            ) : (
              <Badge tone="muted" dot>
                Disabled
              </Badge>
            )}
            {provider.configured ? <Badge tone="success">Configured</Badge> : <Badge tone="warning">Needs setup</Badge>}
            {provider.mode === 'live' ? <Badge tone="brand">Live</Badge> : provider.mode === 'test' ? <Badge tone="info">Test mode</Badge> : null}
          </div>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-zinc-500">{provider.description}</p>
          {provider.methods.length > 0 && <p className="mt-1.5 text-xs text-zinc-500">Methods: {provider.methods.map(methodLabel).join(', ')}</p>}
        </div>
      </header>

      <div className="flex-1 space-y-4 px-5 py-4">
        {provider.fields.length === 0 ? (
          <p className="text-[0.8125rem] text-zinc-500">No credentials required.</p>
        ) : (
          <div>
            <p className="mb-2 text-[0.8125rem] font-medium text-zinc-800">Server environment variables</p>
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
              {provider.fields.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[0.8125rem] text-zinc-900">
                      {f.secret && <Lock size={12} className="text-zinc-400" aria-hidden />}
                      {f.label}
                      {!f.required && <span className="text-xs text-zinc-400">(optional)</span>}
                    </p>
                    <code className="mt-0.5 block truncate font-mono text-[0.6875rem] text-zinc-500">{f.key}</code>
                  </div>
                  {f.configured ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 size={13} aria-hidden /> Set on server
                    </span>
                  ) : (
                    <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs font-medium', f.required ? 'text-amber-700' : 'text-zinc-400')}>
                      <XCircle size={13} aria-hidden /> Not set
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {provider.requiresWebhook && provider.webhookUrl && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[0.8125rem] font-medium text-zinc-800">
              <Webhook size={13} aria-hidden /> Webhook URL
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800" title={provider.webhookUrl}>
                {provider.webhookUrl}
              </code>
              <Button size="sm" variant="secondary" icon={copied ? CheckCircle2 : Copy} onClick={() => void copyWebhook()} aria-label="Copy webhook URL">
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">Register this endpoint in the provider’s dashboard. Orders are confirmed only by signed webhook events.</p>
          </div>
        )}
      </div>
    </article>
  );
}
