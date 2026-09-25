import type { CardDetails, PaymentMethodType } from '@/types';
import { apiClient } from './api/client';
import { USE_MOCK_API } from './config';
import { MockError, delay } from './mock/db';

/**
 * Payment provider abstraction.
 *
 * The UI only ever talks to `paymentService.authorize()`. When a real provider
 * (e.g. Stripe, or a local mobile-money gateway) is integrated, implement a
 * `PaymentProvider` whose `authorize` tokenises details with the provider's
 * SDK / hosted fields and returns the provider reference. Raw card data must
 * never be sent to the SPORTX API or persisted in the browser.
 */
export interface PaymentAuthorization {
  method: PaymentMethodType;
  /** Provider reference or masked descriptor safe to store and display. */
  reference?: string;
}

export interface PaymentProvider {
  id: string;
  supports: PaymentMethodType[];
  authorize(input: { method: PaymentMethodType; amount: number; card?: CardDetails; phone?: string }): Promise<PaymentAuthorization>;
}

/** Demo provider — simulates authorisation, charges nothing. */
const mockProvider: PaymentProvider = {
  id: 'mock',
  supports: ['card', 'mobile-money', 'cash-on-delivery'],
  async authorize({ method, card, phone }) {
    await delay(900, 1400);
    if (method === 'card') {
      const digits = card?.number.replace(/\D/g, '') ?? '';
      // Test hook: numbers ending 0002 simulate a decline.
      if (digits.endsWith('0002')) throw new MockError('Your card was declined. Please try another payment method.', 402);
      return { method, reference: `•••• ${digits.slice(-4)}` };
    }
    if (method === 'mobile-money') {
      const digits = phone?.replace(/\D/g, '') ?? '';
      return { method, reference: `Mobile •••${digits.slice(-3)}` };
    }
    return { method };
  },
};

/** Backend-driven provider — the API creates the payment intent. */
const apiProvider: PaymentProvider = {
  id: 'api',
  supports: ['card', 'mobile-money', 'cash-on-delivery'],
  async authorize({ method, amount }) {
    // TODO(payments): mount the provider's hosted fields and confirm the intent client-side.
    return apiClient.post<PaymentAuthorization>('/payments/intent', { method, amount });
  },
};

const provider: PaymentProvider = USE_MOCK_API ? mockProvider : apiProvider;

export const paymentService = {
  providerId: provider.id,
  isDemo: USE_MOCK_API,
  authorize: provider.authorize,
};
