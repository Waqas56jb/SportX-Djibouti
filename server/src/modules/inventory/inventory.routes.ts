import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { ok, paginated } from '../../utils/apiResponse.js';
import { pageMeta } from '../../utils/pagination.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, query as q, uuidParam } from '../../middleware/validation.middleware.js';
import {
  adjustBody,
  adjustVariant,
  getInventoryItem,
  inventoryListQuery,
  listInventory,
  listMovements,
  movementsQuery,
  patchBody,
  patchVariant,
  type AdjustBody,
  type InventoryListQuery,
  type MovementsQuery,
} from './inventory.admin.service.js';

/** /api/v1/admin/inventory */
export const adminInventoryRouter = Router();

const list = (status?: 'LOW_STOCK' | 'OUT_OF_STOCK') =>
  asyncHandler(async (req, res) => {
    const f = q<InventoryListQuery>(req);
    const { rows, total, summary } = await listInventory(status ? { ...f, status } : f);
    return paginated(res, rows, pageMeta(f.page, f.limit, total), { summary });
  });

adminInventoryRouter.get('/', requirePermission('inventory:view'), validate({ query: inventoryListQuery }), list());
adminInventoryRouter.get('/low-stock', requirePermission('inventory:view'), validate({ query: inventoryListQuery }), list('LOW_STOCK'));
adminInventoryRouter.get('/out-of-stock', requirePermission('inventory:view'), validate({ query: inventoryListQuery }), list('OUT_OF_STOCK'));

adminInventoryRouter.get(
  '/movements',
  requirePermission('inventory:view'),
  validate({ query: movementsQuery }),
  asyncHandler(async (req, res) => {
    const f = q<MovementsQuery>(req);
    const { rows, total } = await listMovements(f);
    return paginated(res, rows, pageMeta(f.page, f.limit, total));
  }),
);

/** Alias used by the admin UI: POST /inventory/adjustments { variantId, mode, quantity, reason, notes }. */
adminInventoryRouter.post(
  '/adjustments',
  requirePermission('inventory:edit'),
  validate({ body: z.object({ variantId: z.string().uuid() }).passthrough() }),
  asyncHandler(async (req, res) => {
    const body = adjustBody.parse(req.body);
    return ok(res, await adjustVariant(req, req.body.variantId, body), 'Stock adjusted.');
  }),
);

const variantParam = uuidParam('variantId');

adminInventoryRouter.get(
  '/:variantId',
  requirePermission('inventory:view'),
  validate({ params: variantParam }),
  asyncHandler(async (req, res) => ok(res, await getInventoryItem(req.params.variantId))),
);

adminInventoryRouter.patch(
  '/:variantId',
  requirePermission('inventory:edit'),
  validate({ params: variantParam, body: patchBody }),
  asyncHandler(async (req, res) => ok(res, await patchVariant(req, req.params.variantId, req.body), 'Inventory updated.')),
);

adminInventoryRouter.post(
  '/:variantId/adjust',
  requirePermission('inventory:edit'),
  validate({ params: variantParam, body: adjustBody }),
  asyncHandler(async (req, res) => ok(res, await adjustVariant(req, req.params.variantId, req.body as AdjustBody), 'Stock adjusted.')),
);
