import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { created, ok, paginated } from '../../utils/apiResponse.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { query as q, uuidParam, validate } from '../../middleware/validation.middleware.js';
import { writeLimiter } from '../../middleware/rateLimit.middleware.js';
import {
  adminListTicketsQuery,
  adminPatchSchema,
  adminReplySchema,
  adminStatusSchema,
  createTicketSchema,
  customerListQuery,
  customerReplySchema,
  type AdminListTicketsQuery,
  type CustomerListQuery,
} from './support.schema.js';
import { supportService } from './support.service.js';

/** /api/v1/support — the signed-in customer's tickets. Internal staff notes are never returned. */
export const supportRouter = Router();
supportRouter.use(authenticate);

supportRouter.get(
  '/tickets',
  validate({ query: customerListQuery }),
  asyncHandler(async (req, res) => {
    const { rows, meta } = await supportService.listForCustomer(req.auth!.userId, q<CustomerListQuery>(req));
    return paginated(res, rows, meta);
  }),
);

supportRouter.post(
  '/tickets',
  writeLimiter,
  validate({ body: createTicketSchema }),
  asyncHandler(async (req, res) => created(res, await supportService.create(req.auth!.userId, req.body), 'Request sent. Our team will reply soon.')),
);

supportRouter.get(
  '/tickets/:id',
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => ok(res, await supportService.getForCustomer(req.auth!.userId, req.params.id))),
);

supportRouter.post(
  '/tickets/:id/messages',
  writeLimiter,
  validate({ params: uuidParam(), body: customerReplySchema }),
  asyncHandler(async (req, res) => ok(res, await supportService.customerReply(req.auth!.userId, req.params.id, req.body.body), 'Reply sent.')),
);

/** /api/v1/admin/support — ticket desk (support:* permissions). */
export const adminSupportRouter = Router();

adminSupportRouter.get(
  '/assignees',
  requirePermission('support:view'),
  asyncHandler(async (_req, res) => ok(res, await supportService.assignees())),
);

adminSupportRouter.get(
  '/tickets',
  requirePermission('support:view'),
  validate({ query: adminListTicketsQuery }),
  asyncHandler(async (req, res) => {
    const { rows, meta, counts } = await supportService.adminList(q<AdminListTicketsQuery>(req));
    return paginated(res, rows, meta, { counts });
  }),
);

adminSupportRouter.get(
  '/tickets/:id',
  requirePermission('support:view'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => ok(res, await supportService.adminGet(req.params.id))),
);

adminSupportRouter.patch(
  '/tickets/:id/status',
  requirePermission('support:edit'),
  validate({ params: uuidParam(), body: adminStatusSchema }),
  asyncHandler(async (req, res) => ok(res, await supportService.update(req, req.params.id, { status: req.body.status }), 'Ticket updated.')),
);

adminSupportRouter.patch(
  '/tickets/:id',
  requirePermission('support:edit'),
  validate({ params: uuidParam(), body: adminPatchSchema }),
  asyncHandler(async (req, res) => ok(res, await supportService.update(req, req.params.id, req.body), 'Ticket updated.')),
);

adminSupportRouter.post(
  '/tickets/:id/messages',
  requirePermission('support:edit'),
  validate({ params: uuidParam(), body: adminReplySchema }),
  asyncHandler(async (req, res) => ok(res, await supportService.adminReply(req, req.params.id, req.body.body, req.body.internal), req.body.internal ? 'Note added.' : 'Reply sent.')),
);
