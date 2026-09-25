import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { ok, paginated } from '../../utils/apiResponse.js';
import { paginationQuery } from '../../utils/pagination.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { query as q, uuidParam, validate } from '../../middleware/validation.middleware.js';
import { looseEnum, queryBool } from '../account/schema-helpers.js';
import { notificationsService, type Scope } from './notifications.service.js';

const NOTIFICATION_TYPES = [
  'ORDER_CREATED', 'PAYMENT_CONFIRMED', 'ORDER_PROCESSING', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'REFUND_PROCESSED', 'SUPPORT_REPLY',
  'LOW_STOCK', 'NEW_ORDER', 'PAYMENT_FAILED', 'REFUND_REQUESTED', 'NEW_TICKET', 'NEW_CUSTOMER', 'REVIEW_PENDING',
] as [string, ...string[]];

const listQuery = paginationQuery(100, 20).extend({ unread: queryBool, type: looseEnum(NOTIFICATION_TYPES).optional() });
const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });
const bulkReadSchema = idsSchema.extend({ read: z.boolean().default(true) });
type ListQuery = z.infer<typeof listQuery>;

/** Same handlers serve the customer and the staff centre; only the scope differs. */
function mountHandlers(router: Router, scopeOf: (req: Request) => Scope) {
  router.get(
    '/',
    validate({ query: listQuery }),
    asyncHandler(async (req, res) => {
      const { rows, meta, unreadCount } = await notificationsService.list(scopeOf(req), q<ListQuery>(req));
      return paginated(res, rows, meta, { unreadCount });
    }),
  );
  router.get('/unread-count', asyncHandler(async (req, res) => ok(res, { unreadCount: await notificationsService.unreadCount(scopeOf(req)) })));

  const readAll = asyncHandler(async (req, res) => ok(res, await notificationsService.readAll(scopeOf(req)), 'All notifications marked as read.'));
  router.patch('/read-all', readAll);
  router.post('/read-all', readAll);

  // Bulk: PATCH / { ids, read } — DELETE / { ids } or POST /delete { ids }.
  router.patch('/', validate({ body: bulkReadSchema }), asyncHandler(async (req, res) => ok(res, await notificationsService.setReadMany(scopeOf(req), req.body.ids, req.body.read))));
  const removeMany = asyncHandler(async (req, res) => ok(res, await notificationsService.removeMany(scopeOf(req), req.body.ids), 'Notifications deleted.'));
  router.delete('/', validate({ body: idsSchema }), removeMany);
  router.post('/delete', validate({ body: idsSchema }), removeMany);

  router.patch('/:id/read', validate({ params: uuidParam() }), asyncHandler(async (req, res) => ok(res, await notificationsService.setRead(scopeOf(req), req.params.id, true))));
  router.patch('/:id/unread', validate({ params: uuidParam() }), asyncHandler(async (req, res) => ok(res, await notificationsService.setRead(scopeOf(req), req.params.id, false))));
  router.delete('/:id', validate({ params: uuidParam() }), asyncHandler(async (req, res) => ok(res, await notificationsService.remove(scopeOf(req), req.params.id), 'Notification deleted.')));
}

/** /api/v1/notifications — the signed-in customer's notifications. */
export const notificationsRouter = Router();
notificationsRouter.use(authenticate);
mountHandlers(notificationsRouter, (req) => ({ kind: 'customer', userId: req.auth!.userId }));

/** /api/v1/admin/notifications — the shared staff notification centre (any staff member). */
export const adminNotificationsRouter = Router();
mountHandlers(adminNotificationsRouter, () => ({ kind: 'staff' }));
