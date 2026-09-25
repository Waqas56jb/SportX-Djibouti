import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../config/database.js';
import { asyncHandler } from '../../utils/http.js';
import { ok } from '../../utils/apiResponse.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { couponLimiter } from '../../middleware/rateLimit.middleware.js';
import { priceCart } from '../pricing/pricing.service.js';
import { cartService } from '../cart/cart.service.js';
import { evaluateCoupon } from './coupon.validation.js';

const validateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  /** Only used when the server cart is empty (preview for unrestricted codes). Never trusted otherwise. */
  subtotal: z.number().int().min(0).max(100_000_000).optional(),
});

/** /api/v1/coupons — customer coupon preview. Does not store the code (see POST /cart/coupon). */
export const couponsRouter = Router();

couponsRouter.post(
  '/validate',
  authenticate,
  couponLimiter,
  validate({ body: validateSchema }),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const code = String(req.body.code).toUpperCase();
    const { lines } = await cartService.lines(userId);

    if (lines.length) {
      const b = await priceCart(lines, { couponCode: code, userId });
      const c = b.coupon!;
      return ok(res, {
        valid: c.valid,
        code: c.code,
        discount: c.valid ? c.discount : 0,
        message: c.message,
        type: c.type ?? null,
        value: c.value ?? null,
        description: c.description ?? null,
        basedOn: 'cart' as const,
      });
    }

    // Empty cart: evaluate against the supplied amount as a single unrestricted line.
    const amount = req.body.subtotal ?? 0;
    const r = await evaluateCoupon(pool, code, {
      userId,
      merchandiseTotal: amount,
      lines: amount > 0 ? [{ productId: '00000000-0000-0000-0000-000000000000', categoryId: '00000000-0000-0000-0000-000000000000', parentCategoryId: null, lineTotal: amount }] : [],
    });
    return ok(
      res,
      r.valid
        ? { valid: true, code: r.coupon.code, discount: r.discount, message: r.message, type: r.coupon.type, value: r.coupon.value, description: r.coupon.description, basedOn: 'subtotal' as const }
        : { valid: false, code: r.code, discount: 0, message: r.message, type: null, value: null, description: null, basedOn: 'subtotal' as const },
    );
  }),
);
