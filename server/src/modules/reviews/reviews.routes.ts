import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { created, noContent, ok, paginated } from '../../utils/apiResponse.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { query as q, uuidParam, validate } from '../../middleware/validation.middleware.js';
import { reviewLimiter, writeLimiter } from '../../middleware/rateLimit.middleware.js';
import {
  adminReviewsQuery,
  bulkStatusSchema,
  createReviewSchema,
  productReviewsQuery,
  reviewStatusSchema,
  updateReviewSchema,
  type AdminReviewsQuery,
  type ProductReviewsQuery,
} from './reviews.schema.js';
import { reviewsService } from './reviews.service.js';

/**
 * /api/v1/products/:id/reviews (mounted by the catalog registry). `:id` is a product UUID or slug.
 * GET → { productId, reviews, summary, pagination } (approved reviews only).
 */
export const productReviewsRouter = Router({ mergeParams: true });

productReviewsRouter.get(
  '/',
  validate({ query: productReviewsQuery }),
  asyncHandler(async (req, res) => ok(res, await reviewsService.forProduct(req.params.id, q<ProductReviewsQuery>(req)))),
);

productReviewsRouter.post(
  '/',
  authenticate,
  reviewLimiter,
  validate({ body: createReviewSchema }),
  asyncHandler(async (req, res) => created(res, await reviewsService.create(req.auth!.userId, req.params.id, req.body), 'Thanks! Your review will appear once it has been checked.')),
);

/** /api/v1/reviews — the signed-in customer's own reviews. */
export const customerReviewsRouter = Router();
customerReviewsRouter.use(authenticate);

customerReviewsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => ok(res, await reviewsService.mine(req.auth!.userId))),
);

customerReviewsRouter.patch(
  '/:id',
  writeLimiter,
  validate({ params: uuidParam(), body: updateReviewSchema }),
  asyncHandler(async (req, res) => ok(res, await reviewsService.update(req.auth!.userId, req.params.id, req.body), 'Review updated. It will appear again once checked.')),
);

customerReviewsRouter.delete(
  '/:id',
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    await reviewsService.removeOwn(req.auth!.userId, req.params.id);
    return noContent(res, 'Review deleted.');
  }),
);

/** /api/v1/admin/reviews — moderation. */
export const adminReviewsRouter = Router();

adminReviewsRouter.get(
  '/',
  requirePermission('reviews:view'),
  validate({ query: adminReviewsQuery }),
  asyncHandler(async (req, res) => {
    const { rows, meta, counts } = await reviewsService.adminList(q<AdminReviewsQuery>(req));
    return paginated(res, rows, meta, { counts });
  }),
);

adminReviewsRouter.patch(
  '/bulk',
  requirePermission('reviews:approve'),
  validate({ body: bulkStatusSchema }),
  asyncHandler(async (req, res) => ok(res, await reviewsService.bulkStatus(req, req.body.ids, req.body.status), 'Reviews updated.')),
);

adminReviewsRouter.get(
  '/:id',
  requirePermission('reviews:view'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => ok(res, await reviewsService.adminGet(req.params.id))),
);

adminReviewsRouter.patch(
  '/:id/status',
  requirePermission('reviews:approve'),
  validate({ params: uuidParam(), body: reviewStatusSchema }),
  asyncHandler(async (req, res) => ok(res, await reviewsService.setStatus(req, req.params.id, req.body.status), 'Review updated.')),
);

adminReviewsRouter.delete(
  '/:id',
  requirePermission('reviews:delete'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    await reviewsService.adminDelete(req, req.params.id);
    return noContent(res, 'Review deleted.');
  }),
);
