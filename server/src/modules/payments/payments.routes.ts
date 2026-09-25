import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { isProd } from '../../config/env.js';
import { asyncHandler } from '../../utils/http.js';
import { ok, created } from '../../utils/apiResponse.js';
import { AppError, notFound } from '../../utils/errors.js';
import { queryOne } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate, uuidParam } from '../../middleware/validation.middleware.js';
import { paymentLimiter } from '../../middleware/rateLimit.middleware.js';
import { availablePaymentMethods, enabledProviders } from '../../services/payment/payment.registry.js';
import { signMockPayload, SIGNATURE_HEADER, type MockEventBody } from '../../services/payment/providers/mock.provider.js';
import { paymentsService } from './payments.service.js';

export const idempotencyKeyOf = (header: string | undefined) => (header && /^[A-Za-z0-9_-]{8,128}$/.test(header) ? header : null);

/** /api/v1/payments */
export const paymentsRouter = Router();

paymentsRouter.get('/methods', (_req, res) => ok(res, availablePaymentMethods()));

paymentsRouter.post(
  '/create',
  authenticate,
  paymentLimiter,
  validate({ body: z.object({ orderId: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const result = await paymentsService.createForOrder(req.auth!.userId, req.body.orderId, idempotencyKeyOf(req.header('idempotency-key')));
    return created(res, result);
  }),
);

paymentsRouter.get(
  '/:id',
  authenticate,
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => ok(res, await paymentsService.getForCustomer(req.auth!.userId, req.params.id))),
);

/**
 * Development/test only: simulates the gateway completing the payment by sending a correctly
 * signed webhook through the real webhook pipeline (signature check, idempotency, order update).
 */
if (!isProd && enabledProviders.some((p) => p.id === 'mock')) {
  paymentsRouter.post(
    '/:id/mock-complete',
    authenticate,
    validate({ params: uuidParam(), body: z.object({ outcome: z.enum(['succeeded', 'failed']).default('succeeded'), last4: z.string().regex(/^\d{4}$/).optional() }) }),
    asyncHandler(async (req, res) => {
      const p = await queryOne<{ id: string; provider: string; provider_payment_id: string | null; amount: number; user_id: string }>(
        `select p.id, p.provider, p.provider_payment_id, p.amount, o.user_id from public.payments p join public.orders o on o.id = p.order_id where p.id = $1`,
        [req.params.id],
      );
      if (!p || p.user_id !== req.auth!.userId) throw notFound('Payment');
      if (p.provider !== 'mock' || !p.provider_payment_id) throw new AppError('VALIDATION_ERROR', 'This payment was not started with the test provider.');
      const body: MockEventBody = {
        id: `evt_${crypto.randomUUID()}`,
        type: req.body.outcome === 'succeeded' ? 'payment.succeeded' : 'payment.failed',
        data: {
          providerPaymentId: p.provider_payment_id,
          paymentId: p.id,
          amount: p.amount,
          failureReason: req.body.outcome === 'failed' ? 'Card declined (test)' : undefined,
          card: req.body.outcome === 'succeeded' ? { brand: 'visa', last4: req.body.last4 ?? '4242' } : undefined,
        },
      };
      const raw = JSON.stringify(body);
      const provider = enabledProviders.find((x) => x.id === 'mock')!;
      const event = await provider.parseWebhook(Buffer.from(raw), { [SIGNATURE_HEADER]: signMockPayload(raw) });
      const outcome = await paymentsService.handleWebhook(provider, event);
      return ok(res, { outcome, payment: await paymentsService.getForCustomer(req.auth!.userId, p.id) });
    }),
  );
}
