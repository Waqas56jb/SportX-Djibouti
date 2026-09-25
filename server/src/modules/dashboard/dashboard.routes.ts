import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { ok } from '../../utils/apiResponse.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, query as q } from '../../middleware/validation.middleware.js';
import { rangeQuery, type RangeQuery } from '../reports/range.js';
import { getDashboard, navCounts } from './dashboard.service.js';

/** /api/v1/admin/dashboard */
export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  requirePermission('dashboard:view'),
  validate({ query: rangeQuery }),
  asyncHandler(async (req, res) => ok(res, await getDashboard(q<RangeQuery>(req)))),
);

/** Sidebar badge counts. Any staff member (the numbers carry no sensitive detail). */
dashboardRouter.get(
  '/nav-counts',
  asyncHandler(async (_req, res) => ok(res, await navCounts())),
);
