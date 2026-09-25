import { Server, ShieldCheck } from 'lucide-react';
import { settingsService } from '@/services/settingsService';
import { useAsync } from '@/hooks/useAsync';
import { ErrorState, SkeletonPanel } from '@/components/common/States';
import { Callout, SettingsLayout, StatTile } from '@/components/settings/SettingsKit';
import { PaymentProviderCard } from '@/components/settings/PaymentProviderCard';

/** Read-only: providers, keys and live/test mode are configured in the API server's environment. */
export default function PaymentSettingsPage() {
  const { data, loading, error, reload } = useAsync(() => settingsService.getPaymentSettings(), []);

  const list = data?.providers ?? [];
  const enabled = list.filter((p) => p.enabled);

  return (
    <SettingsLayout title="Payments" description="Payment methods offered at checkout and whether each provider is fully configured.">
      <Callout icon={ShieldCheck} tone="dark" className="mb-6" title="Configured on the server, never in the browser">
        Enabled providers, API keys and webhook signing secrets are set through the API server’s environment variables (for example <code className="font-mono text-xs">PAYMENT_PROVIDERS</code>, <code className="font-mono text-xs">STRIPE_SECRET_KEY</code>, <code className="font-mono text-xs">STRIPE_WEBHOOK_SECRET</code>). This screen is read-only: it never displays, accepts or transmits a key — it only shows whether each one is set. Ask your server administrator to change them and restart the API.
      </Callout>

      {error ? (
        <div className="panel">
          <ErrorState onRetry={() => void reload()} description={error.message || 'We couldn’t load payment providers. Please try again.'} />
        </div>
      ) : loading ? (
        <div className="grid gap-5 xl:grid-cols-2" aria-busy="true" aria-label="Loading payment providers">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonPanel key={i} rows={5} />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Enabled providers" value={`${enabled.length}/${list.length}`} hint="Offered at checkout" />
            <StatTile label="Configured" value={list.filter((p) => p.configured).length} hint="All required variables set" />
            <StatTile label="Live" value={enabled.filter((p) => p.mode === 'live').length} hint="Processing real payments" />
            <StatTile label="Needs setup" value={enabled.filter((p) => !p.configured).length} hint="Enabled but missing variables" />
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-2">
            {list.map((p) => (
              <PaymentProviderCard key={p.id} provider={p} />
            ))}
          </div>
          {data?.note && (
            <Callout icon={Server} tone="neutral" className="mt-6">
              {data.note}
            </Callout>
          )}
        </>
      )}
    </SettingsLayout>
  );
}
