import { WebhookSignatureError, type PaymentProvider } from '../payment.provider.js';

/** Cash on delivery: nothing to authorise online; the payment is marked PAID when the order is delivered. */
export const cashOnDeliveryProvider: PaymentProvider = {
  id: 'cash_on_delivery',
  displayName: 'Cash on delivery',
  methods: ['CASH_ON_DELIVERY'],
  requiresWebhookConfirmation: false,
  async createPayment() {
    return { providerPaymentId: null, status: 'PENDING' };
  },
  async parseWebhook() {
    throw new WebhookSignatureError('Cash on delivery has no webhooks.');
  },
  async refund() {
    // Cash refunds are handed back in store / by courier and recorded manually.
    return { status: 'COMPLETED', providerReference: 'MANUAL' };
  },
};
