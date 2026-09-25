import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { ok } from '../../utils/apiResponse.js';
import { validate } from '../../middleware/validation.middleware.js';
import { optionalAuth } from '../../middleware/auth.middleware.js';
import { pool } from '../../config/database.js';
import { priceCart } from '../pricing/pricing.service.js';
import { ordersService } from '../orders/orders.service.js';
import { getStoreSettings, publicSettings } from '../settings/settings.service.js';
import { shippingService } from './shipping.service.js';

/** /api/v1/shipping */
export const shippingRouter = Router();

shippingRouter.get(
  '/methods',
  asyncHandler(async (_req, res) => {
    const [methods, settings] = await Promise.all([shippingService.listActiveMethods(), getStoreSettings()]);
    return ok(res, {
      freeShippingThreshold: settings.freeShippingThreshold,
      currency: settings.currency,
      methods: methods.map(({ regions: _r, ...m }) => m),
    });
  }),
);

/**
 * Quotes all methods. Signed-in customers get quotes for their server cart; otherwise pass
 * `merchandiseTotal` (e.g. product page "free delivery over …" hints).
 */
shippingRouter.post(
  '/estimate',
  optionalAuth,
  validate({ body: z.object({ city: z.string().trim().max(80).optional(), merchandiseTotal: z.number().int().min(0).max(100_000_000).optional() }) }),
  asyncHandler(async (req, res) => {
    let total = req.body.merchandiseTotal ?? 0;
    if (req.auth) {
      const lines = await ordersService.cartLines(pool, req.auth.userId);
      if (lines.length) {
        const b = await priceCart(lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), { couponCode: lines[0].couponCode, userId: req.auth.userId });
        total = b.totals.merchandiseTotal - b.totals.couponDiscount;
      }
    }
    return ok(res, { merchandiseTotal: total, options: await shippingService.quoteAll(total, req.body.city) });
  }),
);

/** /api/v1/store — public store configuration (no secrets). */
export const storeRouter = Router();
storeRouter.get('/', asyncHandler(async (_req, res) => ok(res, publicSettings(await getStoreSettings()))));
