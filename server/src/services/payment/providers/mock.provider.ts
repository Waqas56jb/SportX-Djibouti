import crypto from 'node:crypto';
import { env } from '../../../config/env.js';
import { WebhookSignatureError, type NormalizedWebhookEvent, type PaymentProvider } from '../payment.provider.js';

/**
 * Development/test card + mobile-money provider. Behaves like a real asynchronous gateway:
 * creating a payment returns a client secret, and success/failure only arrives through a
 * signed webhook. Refused in production by env validation.
 */
export const mockSecret = () => env.MOCK_PAYMENT_WEBHOOK_SECRET ?? `mock:${env.JWT_SECRET}`;
export const SIGNATURE_HEADER = 'x-mock-signature';

export function signMockPayload(body: string): string {
  return crypto.createHmac('sha256', mockSecret()).update(body).digest('hex');
}

export interface MockEventBody {
  id: string;
  type: 'payment.succeeded' | 'payment.failed' | 'refund.succeeded';
  data: { providerPaymentId: string; paymentId?: string; amount?: number; failureReason?: string; card?: { brand: string; last4: string } };
}

export const mockProvider: PaymentProvider = {
  id: 'mock',
  displayName: 'Test payments',
  methods: ['CARD', 'MOBILE_MONEY'],
  requiresWebhookConfirmation: true,
  async createPayment(input) {
    const providerPaymentId = `mock_pi_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    return {
      providerPaymentId,
      status: 'PENDING',
      clientSecret: `${providerPaymentId}_secret_${crypto.randomBytes(8).toString('hex')}`,
      metadata: { method: input.method },
    };
  },
  async parseWebhook(rawBody, headers) {
    const sig = headers[SIGNATURE_HEADER];
    const expected = signMockPayload(rawBody.toString('utf8'));
    if (typeof sig !== 'string' || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new WebhookSignatureError('Invalid mock webhook signature.');
    }
    const body = JSON.parse(rawBody.toString('utf8')) as MockEventBody;
    const e: NormalizedWebhookEvent = {
      eventId: body.id,
      type: body.type,
      providerPaymentId: body.data.providerPaymentId,
      paymentId: body.data.paymentId,
      amount: body.data.amount,
      failureReason: body.data.failureReason,
      card: body.data.card,
      raw: body,
    };
    return e;
  },
  async refund(input) {
    return { status: 'COMPLETED', providerReference: `mock_re_${input.idempotencyKey.slice(0, 16)}` };
  },
};
