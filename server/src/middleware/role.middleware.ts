import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../utils/errors.js';
import type { AuthContext } from '../types/auth.js';

export function hasPermission(ctx: AuthContext | undefined, ...keys: string[]): boolean {
  if (!ctx) return false;
  return keys.every((k) => ctx.permissions.has(k));
}

/** Requires every listed permission, e.g. requirePermission('orders:edit'). Use after requireAdmin. */
export const requirePermission =
  (...keys: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (!hasPermission(req.auth, ...keys)) return next(forbidden(`Missing permission: ${keys.join(', ')}.`));
    next();
  };

/** Requires at least one of the listed roles (by slug). */
export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.some((r) => req.auth!.roles.includes(r))) return next(forbidden());
    next();
  };
