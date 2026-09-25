import { t } from '@/i18n';
import type { CardDetails, Order, PaymentMethodOption, PaymentMethodType } from '@/types';
import { ApiError, api, newIdempotencyKey } from './api';
import { orderService, toPaymentMethodOption } from './orderService';

/**
 * Payments.
 *
 * Flow for online methods (CARD / MOBILE_MONEY):
 *   1. `POST /orders`                → order in PAYMENT_PENDING
 *   2. `POST /payments/create`       → { payment, provider, clientSecret, redirectUrl }
 *   3. provider gateway `confirm()`  → the provider settles the payment (webhook on the API)
 *   4. poll `GET /orders/:id`        → paymentStatus PAID or FAILED
 *
 * Raw card data never leaves the browser: the `mock` gateway only derives the last 4 digits and
 * the test outcome; a real gateway (Stripe) collects card details in its own hosted fields.
 */

export interface PublicPayment {
  id: string;
  orderId: string;
  provider: string;
  method: string;
  status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | string;
  amount: number;
  currency: string;
  cardBrand: string | null;
  cardLast4: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentSession {
  payment: PublicPayment;
  provider: string;
  clientSecret: string | null;
  redirectUrl: string | null;
}

/** Details the customer typed in the storefront form. Stay in memory; never sent to SPORTX. */
export interface PaymentDetails {
  method: PaymentMethodType;
  card?: CardDetails;
  phone?: string;
}

export type GatewayOutcome = 'succeeded' | 'failed' | 'pending';

export interface PaymentGateway {
  id: string;
  /** True when the storefront's own card / wallet form is used (mock); false for hosted fields. */
  usesStorefrontForm: boolean;
  confirm(session: PaymentSession, details: PaymentDetails): Promise<GatewayOutcome>;
}

export class PaymentConfigError extends ApiError {
  constructor(message: string) {
    super(message, 0, 'PAYMENT_NOT_CONFIGURED');
    this.name = 'PaymentConfigError';
  }
}

// ───────────────────────── Gateways ─────────────────────────

/**
 * Test provider (local / staging only). The card / wallet form is UI-only: we pass the outcome and
 * the last 4 digits to the API's signed test webhook. Card numbers ending 0002 simulate a decline.
 */
const mockGateway: PaymentGateway = {
  id: 'mock',
  usesStorefrontForm: true,
  async confirm(session, details) {
    const digits = details.card?.number.replace(/\D/g, '') ?? '';
    const outcome = details.method === 'card' && digits.endsWith('0002') ? 'failed' : 'succeeded';
    const last4 = details.method === 'card' && /^\d{4}$/.test(digits.slice(-4)) ? digits.slice(-4) : undefined;
    await api.post(`/payments/${session.payment.id}/mock-complete`, { outcome, ...(last4 ? { last4 } : {}) });
    return outcome;
  },
};

/**
 * Stripe. To enable: `npm i @stripe/stripe-js`, set VITE_STRIPE_PUBLISHABLE_KEY, then in `confirm`
 * `loadStripe(key)`, mount a Payment/Card Element in the payment step and call
 * `stripe.confirmPayment({ clientSecret: session.clientSecret, elements, redirect: 'if_required' })`.
 * The API webhook marks the order PAID; the storefront then polls the order as for other providers.
 * Until that is wired, this gateway fails loudly instead of pretending to succeed.
 */
const stripeGateway: PaymentGateway = {
  id: 'stripe',
  usesStorefrontForm: false,
  async confirm(session) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
    if (!key) throw new PaymentConfigError(t('checkout.errors.stripeMissing'));
    if (!session.clientSecret) throw new PaymentConfigError(t('checkout.errors.startFailed'));
    throw new PaymentConfigError(t('checkout.errors.stripeNotInstalled'));
  },
};

/** Providers that finish by redirecting the customer (hosted payment pages). */
const redirectGateway: PaymentGateway = {
  id: 'redirect',
  usesStorefrontForm: false,
  async confirm(session) {
    if (!session.redirectUrl) throw new PaymentConfigError(t('checkout.errors.providerUnsupported'));
    window.location.assign(session.redirectUrl);
    return 'pending';
  },
};

const GATEWAYS: Record<string, PaymentGateway> = { mock: mockGateway, stripe: stripeGateway };

export function gatewayFor(provider: string, session?: PaymentSession): PaymentGateway {
  return GATEWAYS[provider] ?? (session?.redirectUrl ? redirectGateway : { ...redirectGateway, id: provider });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────── Public API ─────────────────────────

export const paymentService = {
  /** Methods the API currently accepts (`GET /payments/methods`). */
  async methods(): Promise<PaymentMethodOption[]> {
    const rows = await api.get<{ method: PaymentMethodOption['method']; provider: string; label: string }[]>('/payments/methods');
    return rows.map(toPaymentMethodOption);
  },

  /** Starts (or restarts) a payment for a PAYMENT_PENDING order. Reuse `idempotencyKey` when retrying the same attempt. */
  create(orderId: string, idempotencyKey: string): Promise<PaymentSession> {
    return api.post<PaymentSession>('/payments/create', { orderId }, { idempotencyKey });
  },

  get(paymentId: string): Promise<PublicPayment> {
    return api.get<PublicPayment>(`/payments/${paymentId}`);
  },

  /** Polls the order until its payment is settled (PAID / FAILED) or the timeout elapses. */
  async waitForSettlement(orderId: string, { timeoutMs = 20_000, intervalMs = 1_200 } = {}): Promise<Order | null> {
    const deadline = Date.now() + timeoutMs;
    let last: Order | null = null;
    for (;;) {
      last = await orderService.getById(orderId);
      if (!last || last.paymentStatus === 'paid' || last.paymentStatus === 'failed' || last.status === 'cancelled') return last;
      if (Date.now() > deadline) return last;
      await sleep(intervalMs);
    }
  },

  /** Polls one payment until the provider settles it (anything but PENDING / AUTHORIZED) or the timeout elapses. */
  async waitForPayment(paymentId: string, { timeoutMs = 20_000, intervalMs = 1_000 } = {}): Promise<PublicPayment> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const p = await paymentService.get(paymentId);
      if ((p.status !== 'PENDING' && p.status !== 'AUTHORIZED') || Date.now() > deadline) return p;
      await sleep(intervalMs);
    }
  },

  /**
   * Full online payment for an existing order: create → gateway confirm → poll.
   * Resolves with the refreshed order; throws with a friendly message when the payment failed.
   */
  async payOrder(orderId: string, details: PaymentDetails, idempotencyKey = newIdempotencyKey()): Promise<Order> {
    const session = await paymentService.create(orderId, idempotencyKey);
    const gateway = gatewayFor(session.provider, session);
    const outcome = await gateway.confirm(session, details);
    // Watch THIS attempt: the order keeps the previous attempt's FAILED status until the new one settles.
    const payment = outcome === 'pending' ? session.payment : await paymentService.waitForPayment(session.payment.id);
    const order = await orderService.getById(orderId);
    if (!order) throw new ApiError(t('checkout.errors.orderNotFound'), 404);
    if (payment.status === 'PAID' || order.paymentStatus === 'paid') return order.paymentStatus === 'paid' ? order : ((await paymentService.waitForSettlement(orderId, { timeoutMs: 5_000 })) ?? order);
    if (payment.status === 'FAILED' || payment.status === 'CANCELLED' || outcome === 'failed') {
      throw new ApiError(
        payment.failureReason && !/test/i.test(payment.failureReason)
          ? t('checkout.errors.declinedReason', { reason: payment.failureReason })
          : t('checkout.errors.declined'),
        402,
        'PAYMENT_FAILED',
      );
    }
    // Still pending (slow webhook) — the confirmation page keeps checking.
    return order;
  },

  /** Kept for the demo label in the payment step: true when any offered method uses the test provider. */
  isTestProvider: (methods: PaymentMethodOption[]) => methods.some((m) => m.provider === 'mock'),
};
