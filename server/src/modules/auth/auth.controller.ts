import type { Request, Response } from 'express';
import { ok, created, noContent } from '../../utils/apiResponse.js';
import { unauthorized } from '../../utils/errors.js';
import { clientIp } from '../../utils/http.js';
import { audit } from '../../services/audit.service.js';
import { toPublicUser } from '../users/users.mapper.js';
import { adminIdentity, authService, getUser } from './auth.service.js';
import { clearRefreshCookie, readRefreshCookie, revokeRefreshSession, rotateRefreshSession, setRefreshCookie, type TokenScope } from './tokens.js';
import type { IssuedSession } from '../../types/auth.js';

const meta = (req: Request) => ({ userAgent: req.header('user-agent') ?? undefined, ip: clientIp(req) });

/** Access token goes in the body (kept in memory by the SPA); refresh token only in an HttpOnly cookie. */
function sendSession(res: Response, scope: TokenScope, session: IssuedSession, remember = true) {
  setRefreshCookie(res, scope, session.refreshToken, session.refreshExpiresAt, remember);
  return { accessToken: session.accessToken, expiresAt: new Date(session.expiresAt).toISOString() };
}

export const authController = {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body, meta(req));
    if (!result.session) return created(res, { user: result.user, requiresEmailVerification: true }, 'Check your inbox to verify your email address.');
    return created(res, { user: result.user, ...sendSession(res, 'customer', result.session), requiresEmailVerification: false }, 'Account created.');
  },

  async login(req: Request, res: Response) {
    const { user, session } = await authService.login(req.body.email, req.body.password, 'customer', meta(req));
    return ok(res, { user, ...sendSession(res, 'customer', session, req.body.remember) });
  },

  async refresh(scope: TokenScope, req: Request, res: Response) {
    const token = readRefreshCookie(req, scope);
    if (!token) throw unauthorized('No active session.');
    const { userId, session } = await rotateRefreshSession(token, scope, meta(req));
    const user = await getUser(userId);
    if (!user || user.status !== 'ACTIVE') {
      clearRefreshCookie(res, scope);
      throw unauthorized('Session expired. Please sign in again.');
    }
    const body = sendSession(res, scope, session);
    if (scope === 'admin') return ok(res, { ...(await adminIdentity(userId)), ...body });
    return ok(res, { user: toPublicUser(user), ...body });
  },

  async logout(scope: TokenScope, req: Request, res: Response) {
    const token = readRefreshCookie(req, scope);
    if (token) await revokeRefreshSession(token);
    clearRefreshCookie(res, scope);
    return noContent(res, 'Signed out.');
  },

  async me(req: Request, res: Response) {
    const user = await getUser(req.auth!.userId);
    if (!user) throw unauthorized('Account not found.');
    return ok(res, { user: toPublicUser(user) });
  },

  async forgotPassword(req: Request, res: Response) {
    await authService.requestPasswordReset(req.body.email, req.baseUrl.includes('/admin/') ? 'admin' : 'customer');
    return noContent(res, 'If an account exists for this email, a reset link is on its way.');
  },

  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(req.body.token, req.body.password);
    return noContent(res, 'Password updated. You can now sign in.');
  },

  async verifyEmail(req: Request, res: Response) {
    const user = await authService.verifyEmail(req.body.token);
    return ok(res, { user }, 'Email verified.');
  },

  async resendVerification(req: Request, res: Response) {
    await authService.resendVerification(req.body.email);
    return noContent(res, 'If the account needs verification, a new email has been sent.');
  },

  // ─── Admin ────────────────────────────────────────────────────────────────
  async adminLogin(req: Request, res: Response) {
    try {
      const { user, session } = await authService.login(req.body.email, req.body.password, 'admin', meta(req));
      await audit(req, { adminId: user.id, action: 'Admin signed in', entityType: 'auth', entityId: user.id, metadata: { email: user.email } });
      return ok(res, { ...(await adminIdentity(user.id)), ...sendSession(res, 'admin', session, req.body.remember) });
    } catch (err) {
      await audit(req, { adminId: null, action: 'Admin sign-in failed', entityType: 'auth', metadata: { email: req.body.email }, status: 'FAILED' });
      throw err;
    }
  },

  async adminMe(req: Request, res: Response) {
    return ok(res, await adminIdentity(req.auth!.userId));
  },
};
