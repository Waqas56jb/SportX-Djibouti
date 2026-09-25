import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { created, ok, paginated } from '../../utils/apiResponse.js';
import { pageMeta } from '../../utils/pagination.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, query as q, uuidParam } from '../../middleware/validation.middleware.js';
import { getStaff, inviteBody, inviteStaff, listStaff, resetAccess, setStaffStatus, staffListQuery, staffStatusBody, updateBody, updateStaff } from './staff.service.js';

/** /api/v1/admin/staff (also mounted at /admin-users for the admin UI). */
export const staffRouter = Router();

staffRouter.get(
  '/',
  requirePermission('settings:view'),
  validate({ query: staffListQuery }),
  asyncHandler(async (req, res) => {
    const f = q<z.infer<typeof staffListQuery>>(req);
    const { rows, total } = await listStaff(f);
    return paginated(res, rows, pageMeta(f.page, f.limit, total));
  }),
);

staffRouter.get('/:id', requirePermission('settings:view'), validate({ params: uuidParam() }), asyncHandler(async (req, res) => ok(res, await getStaff(req.params.id))));

staffRouter.post(
  '/',
  requirePermission('settings:create'),
  validate({ body: inviteBody }),
  asyncHandler(async (req, res) => created(res, await inviteStaff(req, req.body), 'Invitation sent. The new admin will choose their own sign-in credentials from the email link.')),
);

for (const method of ['patch', 'put'] as const) {
  staffRouter[method](
    '/:id',
    requirePermission('settings:edit'),
    validate({ params: uuidParam(), body: updateBody }),
    asyncHandler(async (req, res) => ok(res, await updateStaff(req, req.params.id, req.body), 'Admin updated.')),
  );
}

staffRouter.patch(
  '/:id/status',
  requirePermission('settings:edit'),
  validate({ params: uuidParam(), body: staffStatusBody }),
  asyncHandler(async (req, res) => ok(res, await setStaffStatus(req, req.params.id, req.body), 'Admin status updated.')),
);

staffRouter.post(
  '/:id/reset-access',
  requirePermission('settings:edit'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => ok(res, await resetAccess(req, req.params.id), 'Sessions revoked and reset email sent.')),
);
