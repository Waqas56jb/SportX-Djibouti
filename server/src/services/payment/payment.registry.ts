import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import type { PaymentMethod } from '../../types/common.js';
import type { PaymentProvider } from './payment.provider.js';
import { cashOnDeliveryProvider } from './providers/cod.provider.js';
import { mockProvider } from './providers/mock.provider.js';
import { stripeProvider } from './providers/stripe.provider.js';

const ALL: Record<string, PaymentProvider> = {
  cash_on_delivery: cashOnDeliveryProvider,
  stripe: stripeProvider,
  mock: mockProvider,
};

/** Providers enabled by PAYMENT_PROVIDERS, in configured order. */
export const enabledProviders: PaymentProvider[] = env.PAYMENT_PROVIDERS.map((id) => ALL[id]).filter((p): p is PaymentProvider => Boolean(p));

export function providerById(id: string): PaymentProvider {
  const p = enabledProviders.find((x) => x.id === id);
  if (!p) throw new AppError('NOT_FOUND', 'Unknown payment provider.');
  return p;
}

/** First enabled provider that supports the method, or PAYMENT_FAILED when the method is unavailable. */
export function providerForMethod(method: PaymentMethod): PaymentProvider {
  const p = enabledProviders.find((x) => x.methods.includes(method));
  if (!p) throw new AppError('PAYMENT_FAILED', `${method.replace(/_/g, ' ').toLowerCase()} is not available right now.`, { method });
  return p;
}

export function availablePaymentMethods(): { method: PaymentMethod; provider: string; label: string }[] {
  const seen = new Set<PaymentMethod>();
  const out: { method: PaymentMethod; provider: string; label: string }[] = [];
  for (const p of enabledProviders) for (const m of p.methods) if (!seen.has(m)) {
    seen.add(m);
    out.push({ method: m, provider: p.id, label: p.displayName });
  }
  return out;
}
