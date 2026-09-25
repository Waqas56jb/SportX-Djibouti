import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../utils/errors.js';
import { authenticateAny } from './auth.middleware.js';

/**
 * Admin gate: authenticated + active (checked in authenticate) + admin-scoped token + staff role.
 * Role and permissions are loaded from the database on the server; the client's view is never trusted.
 */
export const requireAdmin: RequestHandler[] = [
  authenticateAny,
  (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (req.auth.scope !== 'admin') return next(forbidden('Sign in to the admin to use this API.'));
    if (!req.auth.isStaff) return next(forbidden('Staff access required.'));
    next();
  },
];
