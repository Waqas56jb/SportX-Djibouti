import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { ok, paginated } from '../../utils/apiResponse.js';
import { pageMeta } from '../../utils/pagination.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, query as q, uuidParam } from '../../middleware/validation.middleware.js';
import {
  customerActivity,
  customerDetail,
  customerListQuery,
  customerOrders,
  customerOrdersQuery,
  groupSummary,
  listCustomers,
  requireCustomer,
  setCustomerStatus,
  statusBody,
  updateCustomer,
  updateCustomerBody,
  type CustomerListQuery,
} from './admin-customers.service.js';

/** /api/v1/admin/customers */
export const adminCustomersRouter = Router();

adminCustomersRouter.get(
  '/',
  requirePermission('customers:view'),
  validate({ query: customerListQuery }),
  asyncHandler(async (req, res) => {
    const f = q<CustomerListQuery>(req);
    const { rows, total } = await listCustomers(f);
    return paginated(res, rows, pageMeta(f.page, f.limit, total));
  }),
);

adminCustomersRouter.get(
  '/groups',
  requirePermission('customers:view'),
  asyncHandler(async (_req, res) => ok(res, await groupSummary())),
);

adminCustomersRouter.get(
  '/:id',
  requirePermission('customers:view'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => ok(res, await customerDetail(req.params.id))),
);

adminCustomersRouter.get(
  '/:id/activity',
  requirePermission('customers:view'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    await requireCustomer(req.params.id); // 404 for non-customers
    return ok(res, await customerActivity(req.params.id));
  }),
);

adminCustomersRouter.get(
  '/:id/orders',
  requirePermission('customers:view'),
  validate({ params: uuidParam(), query: customerOrdersQuery }),
  asyncHandler(async (req, res) => {
    const f = q<{ page: number; limit: number }>(req);
    const { rows, total } = await customerOrders(req.params.id, f.page, f.limit);
    return paginated(res, rows, pageMeta(f.page, f.limit, total));
  }),
);

adminCustomersRouter.patch(
  '/:id',
  requirePermission('customers:edit'),
  validate({ params: uuidParam(), body: updateCustomerBody }),
  asyncHandler(async (req, res) => ok(res, await updateCustomer(req, req.params.id, req.body), 'Customer updated.')),
);

adminCustomersRouter.patch(
  '/:id/status',
  requirePermission('customers:edit'),
  validate({ params: uuidParam(), body: statusBody }),
  asyncHandler(async (req, res) => ok(res, await setCustomerStatus(req, req.params.id, req.body), 'Customer status updated.')),
);
