import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { loadAuthContext } from '../modules/auth/auth.context.js';
import { AppError, forbidden, unauthorized } from '../utils/errors.js';

function bearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

async function resolve(header: string | undefined) {
  const token = bearer(header);
  if (!token) return null;
  const claims = await verifyAccessToken(token);
  const ctx = await loadAuthContext(claims.userId, claims.scope);
  if (!ctx) throw unauthorized('Account not found.');
  if (ctx.status !== 'ACTIVE') throw new AppError('ACCOUNT_INACTIVE', ctx.status === 'BLOCKED' ? 'This account has been blocked.' : 'This account is inactive.');
  return ctx;
}

/**
 * Requires a valid access token of either app (customer or admin scope). Used by the admin gate
 * and by self-service profile routes (/users/me) that staff also use. Identity always comes from
 * the verified token — never from a user id in the URL, body or client storage.
 */
export const authenticateAny: RequestHandler = (req, _res, next) => {
  resolve(req.header('authorization'))
    .then((ctx) => {
      if (!ctx) throw unauthorized();
      req.auth = ctx;
      next();
    })
    .catch(next);
};

/** Requires a storefront (customer-scoped) access token. Admin tokens cannot shop or read customer data. */
export const authenticate: RequestHandler = (req, res, next) => {
  authenticateAny(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (req.auth!.scope !== 'customer') return next(forbidden('Sign in to the storefront to use this endpoint.'));
    next();
  });
};

/** Attaches identity when a valid token is present; anonymous otherwise (public catalogue endpoints). */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  resolve(req.header('authorization'))
    .then((ctx) => {
      if (ctx) req.auth = ctx;
      next();
    })
    .catch(() => next());
};
