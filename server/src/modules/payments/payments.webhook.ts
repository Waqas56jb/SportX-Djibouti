import express, { Router } from 'express';
import { logger } from '../../utils/logger.js';
import { enabledProviders } from '../../services/payment/payment.registry.js';
import { WebhookSignatureError } from '../../services/payment/payment.provider.js';
import { paymentsService } from './payments.service.js';

/**
 * POST /api/v1/payments/webhook/:provider  (and /api/v1/payments/webhook for Stripe's default setup)
 * Raw body is required for signature verification. Responds 2xx only after the event is stored,
 * so providers retry on failure; duplicates are acknowledged without re-processing.
 */
export const paymentWebhookRouter = Router();

paymentWebhookRouter.post('/:provider?', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const providerId = req.params.provider ?? 'stripe';
  const provider = enabledProviders.find((p) => p.id === providerId && p.requiresWebhookConfirmation);
  if (!provider) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown webhook endpoint.' } });
  try {
    const event = await provider.parseWebhook(req.body as Buffer, req.headers);
    const outcome = await paymentsService.handleWebhook(provider, event);
    res.status(200).json({ success: true, data: { received: true, outcome } });
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      logger.warn({ provider: providerId, requestId: req.id }, 'rejected webhook with invalid signature');
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid signature.' } });
    }
    logger.error({ err, provider: providerId, requestId: req.id }, 'webhook processing failed');
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed.' } });
  }
});
