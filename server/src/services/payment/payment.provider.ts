import type { PaymentMethod, PaymentStatus } from '../../types/common.js';

/**
 * Payment provider abstraction. Business logic (orders, refunds, webhooks) depends only on this
 * interface; Stripe, a local Djibouti mobile-money operator or PayPal plug in as implementations.
 * Providers never receive or return raw card data — card entry happens in the provider's own UI.
 */
export interface CreatePaymentInput {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  customerEmail: string;
  idempotencyKey: string;
}

export interface CreatePaymentResult {
  providerPaymentId: string | null;
  status: PaymentStatus;
  /** Opaque value the frontend passes to the provider SDK (e.g. Stripe client_secret). Never stored. */
  clientSecret?: string;
  /** For redirect-based providers. */
  redirectUrl?: string;
  metadata?: Record<string, unknown>;
}

export type WebhookEventType = 'payment.succeeded' | 'payment.failed' | 'payment.authorized' | 'payment.cancelled' | 'refund.succeeded' | 'refund.failed' | 'ignored';

export interface NormalizedWebhookEvent {
  eventId: string;
  type: WebhookEventType;
  providerPaymentId?: string;
  /** Our payment id, when the provider echoes metadata. */
  paymentId?: string;
  amount?: number;
  failureReason?: string;
  card?: { brand?: string; last4?: string };
  refundReference?: string;
  raw: unknown;
}

export interface RefundInput {
  providerPaymentId: string | null;
  amount: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
}

export interface RefundResult {
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  providerReference: string | null;
  failureReason?: string;
}

export interface PaymentProvider {
  readonly id: string;
  readonly displayName: string;
  readonly methods: PaymentMethod[];
  /** True when payment completes asynchronously and must be confirmed by a verified webhook. */
  readonly requiresWebhookConfirmation: boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Verifies the signature and normalises the event. Must throw on an invalid signature. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<NormalizedWebhookEvent>;
  refund(input: RefundInput): Promise<RefundResult>;
  cancel?(providerPaymentId: string): Promise<void>;
}

export class WebhookSignatureError extends Error {}
