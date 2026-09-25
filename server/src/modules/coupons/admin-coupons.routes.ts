import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { created, noContent, ok, paginated } from '../../utils/apiResponse.js';
import { pageMeta, paginationQuery } from '../../utils/pagination.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, query as q, uuidParam } from '../../middleware/validation.middleware.js';
import { couponBody, couponListQuery, couponUsages, createCoupon, deleteCoupon, getCoupon, listCoupons, updateCoupon, type CouponListQuery } from './coupons.admin.service.js';

/** /api/v1/admin/coupons */
export const adminCouponsRouter = Router();

adminCouponsRouter.get(
  '/',
  requirePermission('discounts:view'),
  validate({ query: couponListQuery }),
  asyncHandler(async (req, res) => {
    const f = q<CouponListQuery>(req);
    const { rows, total, counts } = await listCoupons(f);
    return paginated(res, rows, pageMeta(f.page, f.limit, total), { counts });
  }),
);

adminCouponsRouter.get(
  '/:id',
  requirePermission('discounts:view'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => ok(res, await getCoupon(req.params.id))),
);

adminCouponsRouter.get(
  '/:id/usages',
  requirePermission('discounts:view'),
  validate({ params: uuidParam(), query: paginationQuery() }),
  asyncHandler(async (req, res) => {
    const f = q<{ page: number; limit: number }>(req);
    const { rows, total } = await couponUsages(req.params.id, f.page, f.limit);
    return paginated(res, rows, pageMeta(f.page, f.limit, total));
  }),
);

adminCouponsRouter.post(
  '/',
  requirePermission('discounts:create'),
  validate({ body: couponBody }),
  asyncHandler(async (req, res) => created(res, await createCoupon(req, req.body), 'Coupon created.')),
);

// PATCH = partial update (incl. { enabled }); PUT accepted for the admin UI's full-form save.
for (const method of ['patch', 'put'] as const) {
  adminCouponsRouter[method](
    '/:id',
    requirePermission('discounts:edit'),
    validate({ params: uuidParam(), body: couponBody }),
    asyncHandler(async (req, res) => ok(res, await updateCoupon(req, req.params.id, req.body), 'Coupon updated.')),
  );
}

adminCouponsRouter.delete(
  '/:id',
  requirePermission('discounts:delete'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    await deleteCoupon(req, req.params.id);
    return noContent(res, 'Coupon deleted.');
  }),
);
