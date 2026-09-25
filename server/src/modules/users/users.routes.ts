import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { noContent, ok } from '../../utils/apiResponse.js';
import { AppError } from '../../utils/errors.js';
import { authenticateAny as authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { authLimiter, writeLimiter } from '../../middleware/rateLimit.middleware.js';
import { imageUpload } from '../../middleware/upload.middleware.js';
import { clearRefreshCookie, readRefreshCookie } from '../auth/tokens.js';
import { changePasswordSchema, deleteMeSchema, updateMeSchema } from './users.schema.js';
import { usersService } from './users.service.js';

/** /api/v1/users — the signed-in user's own profile. Identity always comes from the access token. */
export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => ok(res, { user: await usersService.me(req.auth!.userId) })),
);

usersRouter.patch(
  '/me',
  writeLimiter,
  validate({ body: updateMeSchema }),
  asyncHandler(async (req, res) => ok(res, { user: await usersService.updateMe(req.auth!.userId, req.body) }, 'Profile updated.')),
);

usersRouter.post(
  '/me/avatar',
  writeLimiter,
  imageUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('VALIDATION_ERROR', 'Attach an image in the "file" field.');
    return ok(res, { user: await usersService.setAvatar(req.auth!.userId, req.file) }, 'Profile photo updated.');
  }),
);

usersRouter.delete(
  '/me/avatar',
  asyncHandler(async (req, res) => ok(res, { user: await usersService.removeAvatar(req.auth!.userId) }, 'Profile photo removed.')),
);

usersRouter.patch(
  '/me/password',
  authLimiter,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    const scope = req.auth!.scope;
    await usersService.changePassword(req.auth!.userId, req.body.currentPassword, req.body.newPassword, readRefreshCookie(req, scope));
    return noContent(res, 'Password updated. Other devices have been signed out.');
  }),
);

usersRouter.delete(
  '/me',
  authLimiter,
  validate({ body: deleteMeSchema }),
  asyncHandler(async (req, res) => {
    await usersService.deleteMe(req.auth!.userId, req.body.password);
    clearRefreshCookie(res, req.auth!.scope);
    return noContent(res, 'Your account has been deleted.');
  }),
);
