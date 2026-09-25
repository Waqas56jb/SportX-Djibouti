import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middleware/validation.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';
import { authLimiter, passwordResetLimiter } from '../../middleware/rateLimit.middleware.js';
import { authController as c } from './auth.controller.js';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from './auth.schema.js';

/** /api/v1/auth — customer authentication. */
export const authRouter = Router();
authRouter.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(c.register));
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(c.login));
authRouter.post('/refresh', authLimiter, asyncHandler((req, res) => c.refresh('customer', req, res)));
authRouter.post('/logout', asyncHandler((req, res) => c.logout('customer', req, res)));
authRouter.post('/forgot-password', passwordResetLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(c.forgotPassword));
authRouter.post('/reset-password', passwordResetLimiter, validate({ body: resetPasswordSchema }), asyncHandler(c.resetPassword));
authRouter.post('/verify-email', authLimiter, validate({ body: verifyEmailSchema }), asyncHandler(c.verifyEmail));
authRouter.post('/resend-verification', passwordResetLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(c.resendVerification));
authRouter.get('/me', authenticate, asyncHandler(c.me));

/** /api/v1/admin/auth — staff authentication (same infrastructure, admin scope + staff role enforced). */
export const adminAuthRouter = Router();
adminAuthRouter.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(c.adminLogin));
adminAuthRouter.post('/refresh', authLimiter, asyncHandler((req, res) => c.refresh('admin', req, res)));
adminAuthRouter.post('/logout', asyncHandler((req, res) => c.logout('admin', req, res)));
adminAuthRouter.get('/me', ...requireAdmin, asyncHandler(c.adminMe));
adminAuthRouter.post('/forgot-password', passwordResetLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(c.forgotPassword));
adminAuthRouter.post('/reset-password', passwordResetLimiter, validate({ body: resetPasswordSchema }), asyncHandler(c.resetPassword));
