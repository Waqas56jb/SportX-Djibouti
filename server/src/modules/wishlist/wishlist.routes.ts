import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { ok } from '../../utils/apiResponse.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { writeLimiter } from '../../middleware/rateLimit.middleware.js';
import { wishlistService } from './wishlist.service.js';

/** Product reference: UUID or slug. */
const productRef = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9-]+$/, 'Invalid product.');
const productParam = z.object({ productId: productRef });
const mergeSchema = z.object({ productIds: z.array(productRef).max(200) });

/** /api/v1/wishlist — the signed-in customer's wishlist. Responses: { ids, count, items }. */
export const wishlistRouter = Router();
wishlistRouter.use(authenticate);

wishlistRouter.get(
  '/',
  asyncHandler(async (req, res) => ok(res, await wishlistService.get(req.auth!.userId))),
);

wishlistRouter.post(
  '/merge',
  writeLimiter,
  validate({ body: mergeSchema }),
  asyncHandler(async (req, res) => ok(res, await wishlistService.merge(req.auth!.userId, req.body.productIds))),
);

wishlistRouter.get(
  '/check/:productId',
  validate({ params: productParam }),
  asyncHandler(async (req, res) => ok(res, await wishlistService.check(req.auth!.userId, req.params.productId))),
);

wishlistRouter.post(
  '/:productId',
  writeLimiter,
  validate({ params: productParam }),
  asyncHandler(async (req, res) => ok(res, await wishlistService.add(req.auth!.userId, req.params.productId), 'Saved to your wishlist.')),
);

wishlistRouter.delete(
  '/:productId',
  validate({ params: productParam }),
  asyncHandler(async (req, res) => ok(res, await wishlistService.remove(req.auth!.userId, req.params.productId), 'Removed from your wishlist.')),
);
