import Stripe from 'stripe';
import { env } from '../../../config/env.js';
import { WebhookSignatureError, type NormalizedWebhookEvent, type PaymentProvider } from '../payment.provider.js';

let client: Stripe | null = null;
const stripe = () => (client ??= new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia', typescript: true }));

// Stripe treats DJF as a zero-decimal currency (amount = francs); USD/EUR use cents.
const ZERO_DECIMAL = new Set(['DJF']);
const toMinor = (amount: number, currency: string) => (ZERO_DECIMAL.has(currency.toUpperCase()) ? amount : Math.round(amount * 100));
const fromMinor = (amount: number, currency: string) => (ZERO_DECIMAL.has(currency.toUpperCase()) ? amount : amount / 100);

/**
 * Stripe card payments via PaymentIntents. The browser confirms the intent with Stripe.js using the
 * returned client secret; the order is only marked paid when the signed webhook arrives.
 */
export const stripeProvider: PaymentProvider = {
  id: 'stripe',
  displayName: 'Card (Stripe)',
  methods: ['CARD'],
  requiresWebhookConfirmation: true,

  async createPayment(input) {
    const intent = await stripe().paymentIntents.create(
      {
        amount: toMinor(input.amount, input.currency),
        currency: input.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        receipt_email: input.customerEmail,
        description: `SPORTX order ${input.orderNumber}`,
        metadata: { payment_id: input.paymentId, order_id: input.orderId, order_number: input.orderNumber },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return { providerPaymentId: intent.id, status: 'PENDING', clientSecret: intent.client_secret ?? undefined };
  },

  async parseWebhook(rawBody, headers) {
    const sig = headers['stripe-signature'];
    let event: Stripe.Event;
    try {
      event = stripe().webhooks.constructEvent(rawBody, typeof sig === 'string' ? sig : '', env.STRIPE_WEBHOOK_SECRET!);
    } catch (err) {
      throw new WebhookSignatureError((err as Error).message);
    }
    const base = { eventId: event.id, raw: event };
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
      case 'payment_intent.amount_capturable_updated': {
        const pi = event.data.object as Stripe.PaymentIntent;
        let card: NormalizedWebhookEvent['card'];
        if (event.type === 'payment_intent.succeeded' && typeof pi.latest_charge === 'string') {
          const charge = await stripe().charges.retrieve(pi.latest_charge).catch(() => null);
          card = charge?.payment_method_details?.card ? { brand: charge.payment_method_details.card.brand ?? undefined, last4: charge.payment_method_details.card.last4 ?? undefined } : undefined;
        }
        return {
          ...base,
          type:
            event.type === 'payment_intent.succeeded'
              ? 'payment.succeeded'
              : event.type === 'payment_intent.payment_failed'
                ? 'payment.failed'
                : event.type === 'payment_intent.canceled'
                  ? 'payment.cancelled'
                  : 'payment.authorized',
          providerPaymentId: pi.id,
          paymentId: pi.metadata?.payment_id,
          amount: fromMinor(pi.amount_received || pi.amount, pi.currency),
          failureReason: pi.last_payment_error?.message ?? undefined,
          card,
        };
      }
      case 'charge.refunded': {
        const ch = event.data.object as Stripe.Charge;
        return { ...base, type: 'refund.succeeded', providerPaymentId: typeof ch.payment_intent === 'string' ? ch.payment_intent : undefined, amount: fromMinor(ch.amount_refunded, ch.currency) };
      }
      default:
        return { ...base, type: 'ignored' };
    }
  },

  async refund(input) {
    if (!input.providerPaymentId) return { status: 'FAILED', providerReference: null, failureReason: 'No Stripe payment to refund.' };
    try {
      const refund = await stripe().refunds.create(
        { payment_intent: input.providerPaymentId, amount: toMinor(input.amount, input.currency), metadata: { reason: input.reason } },
        { idempotencyKey: input.idempotencyKey },
      );
      return { status: refund.status === 'succeeded' ? 'COMPLETED' : refund.status === 'failed' ? 'FAILED' : 'PROCESSING', providerReference: refund.id, failureReason: refund.failure_reason ?? undefined };
    } catch (err) {
      return { status: 'FAILED', providerReference: null, failureReason: (err as Error).message };
    }
  },

  async cancel(providerPaymentId) {
    await stripe().paymentIntents.cancel(providerPaymentId).catch(() => undefined);
  },
};
