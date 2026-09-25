import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { created, noContent, ok } from '../../utils/apiResponse.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { uuidParam, validate } from '../../middleware/validation.middleware.js';
import { writeLimiter } from '../../middleware/rateLimit.middleware.js';
import { createAddressSchema, updateAddressSchema } from './addresses.schema.js';
import { addressesService } from './addresses.service.js';

/** /api/v1/addresses — the signed-in customer's address book. Other users' addresses are 404. */
export const addressesRouter = Router();
addressesRouter.use(authenticate);

addressesRouter.get(
  '/',
  asyncHandler(async (req, res) => ok(res, await addressesService.list(req.auth!.userId))),
);

addressesRouter.post(
  '/',
  writeLimiter,
  validate({ body: createAddressSchema }),
  asyncHandler(async (req, res) => created(res, await addressesService.create(req.auth!.userId, req.body), 'Address saved.')),
);

addressesRouter.get(
  '/:id',
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => ok(res, await addressesService.get(req.auth!.userId, req.params.id))),
);

addressesRouter.patch(
  '/:id',
  writeLimiter,
  validate({ params: uuidParam(), body: updateAddressSchema }),
  asyncHandler(async (req, res) => ok(res, await addressesService.update(req.auth!.userId, req.params.id, req.body), 'Address updated.')),
);

addressesRouter.patch(
  '/:id/default',
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => ok(res, await addressesService.setDefault(req.auth!.userId, req.params.id), 'Default address updated.')),
);

addressesRouter.delete(
  '/:id',
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    await addressesService.remove(req.auth!.userId, req.params.id);
    return noContent(res, 'Address removed.');
  }),
);
