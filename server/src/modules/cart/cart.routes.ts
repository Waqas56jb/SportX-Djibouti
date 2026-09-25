import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { ok } from '../../utils/apiResponse.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { uuidParam, validate } from '../../middleware/validation.middleware.js';
import { couponLimiter, writeLimiter } from '../../middleware/rateLimit.middleware.js';
import { cartService } from './cart.service.js';

const addItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100).default(1),
});
const updateItemSchema = z.object({ quantity: z.number().int().min(0).max(100) });
const mergeSchema = z.object({
  items: z
    .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(100) }))
    .max(50),
});
const couponSchema = z.object({ code: z.string().trim().min(1).max(40) });

/**
 * /api/v1/cart — the signed-in customer's server-side cart. Every response is the full cart priced
 * by `priceCart`; the client never supplies prices.
 */
export const cartRouter = Router();
cartRouter.use(authenticate);

cartRouter.get(
  '/',
  asyncHandler(async (req, res) => ok(res, await cartService.get(req.auth!.userId))),
);

cartRouter.post(
  '/items',
  writeLimiter,
  validate({ body: addItemSchema }),
  asyncHandler(async (req, res) => ok(res, await cartService.addItem(req.auth!.userId, req.body.variantId, req.body.quantity), 'Added to your bag.')),
);

cartRouter.patch(
  '/items/:id',
  writeLimiter,
  validate({ params: uuidParam(), body: updateItemSchema }),
  asyncHandler(async (req, res) => ok(res, await cartService.updateItem(req.auth!.userId, req.params.id, req.body.quantity))),
);

cartRouter.delete(
  '/items/:id',
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => ok(res, await cartService.removeItem(req.auth!.userId, req.params.id), 'Removed from your bag.')),
);

cartRouter.delete(
  '/',
  asyncHandler(async (req, res) => ok(res, await cartService.clear(req.auth!.userId), 'Your bag is empty.')),
);

cartRouter.post(
  '/merge',
  writeLimiter,
  validate({ body: mergeSchema }),
  asyncHandler(async (req, res) => ok(res, await cartService.merge(req.auth!.userId, req.body.items))),
);

cartRouter.post(
  '/coupon',
  couponLimiter,
  validate({ body: couponSchema }),
  asyncHandler(async (req, res) => ok(res, await cartService.applyCoupon(req.auth!.userId, req.body.code), 'Code applied.')),
);

cartRouter.delete(
  '/coupon',
  asyncHandler(async (req, res) => ok(res, await cartService.removeCoupon(req.auth!.userId), 'Code removed.')),
);
