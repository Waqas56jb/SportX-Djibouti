import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import type { CookieOptions, Response, Request } from 'express';
import { env } from '../../config/env.js';
import { query, queryOne, type Db, pool } from '../../config/database.js';
import { randomToken, sha256 } from '../../utils/http.js';
import { AppError, unauthorized } from '../../utils/errors.js';
import type { IssuedSession } from '../../types/auth.js';

export type TokenScope = 'customer' | 'admin';

const secret = () => new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = 'sportx-api';

export async function signAccessToken(userId: string, scope: TokenScope): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + env.ACCESS_TOKEN_TTL_SECONDS * 1000;
  const token = await new SignJWT({ scope, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(scope === 'admin' ? 'sportx-admin' : 'sportx-customer')
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(secret());
  return { token, expiresAt };
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; scope: TokenScope }> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: ['sportx-admin', 'sportx-customer'], algorithms: ['HS256'] });
    if (payload.typ !== 'access' || typeof payload.sub !== 'string') throw unauthorized('Invalid access token.');
    const scope = payload.scope === 'admin' ? 'admin' : 'customer';
    return { userId: payload.sub, scope };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof joseErrors.JWTExpired) throw new AppError('UNAUTHORIZED', 'Access token expired.', { reason: 'token_expired' });
    throw unauthorized('Invalid access token.');
  }
}

/** Creates a refresh session and returns the opaque token (only its hash is stored). */
export async function createRefreshSession(userId: string, scope: TokenScope, meta: { userAgent?: string; ip?: string }, db: Db = pool): Promise<{ token: string; expiresAt: number }> {
  const token = randomToken(48);
  const expiresAt = Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000;
  await query(
    `insert into public.auth_sessions (user_id, refresh_token_hash, scope, user_agent, ip_address, expires_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [userId, sha256(token), scope, meta.userAgent?.slice(0, 300) ?? null, meta.ip ?? null, new Date(expiresAt).toISOString()],
    db,
  );
  return { token, expiresAt };
}

export async function issueSession(userId: string, scope: TokenScope, meta: { userAgent?: string; ip?: string }): Promise<IssuedSession> {
  const access = await signAccessToken(userId, scope);
  const refresh = await createRefreshSession(userId, scope, meta);
  return { accessToken: access.token, expiresAt: access.expiresAt, refreshToken: refresh.token, refreshExpiresAt: refresh.expiresAt };
}

/**
 * Rotates a refresh token: the presented token is revoked and a new one issued.
 * Re-use of an already-revoked token revokes every session of that user (token theft signal).
 */
export async function rotateRefreshSession(token: string, scope: TokenScope, meta: { userAgent?: string; ip?: string }): Promise<{ userId: string; session: IssuedSession }> {
  const row = await queryOne<{ id: string; user_id: string; scope: string; expires_at: Date; revoked_at: Date | null; rotated_at: Date | null }>(
    `select id, user_id, scope, expires_at, revoked_at, rotated_at from public.auth_sessions where refresh_token_hash = $1`,
    [sha256(token)],
  );
  if (!row || row.scope !== scope) throw unauthorized('Session expired. Please sign in again.');
  if (row.revoked_at) {
    // A token that was already exchanged is being replayed → likely stolen: end every session.
    // Tokens revoked by logout / password change are simply expired.
    if (row.rotated_at) await query(`update public.auth_sessions set revoked_at = now() where user_id = $1 and revoked_at is null`, [row.user_id]);
    throw unauthorized('Session expired. Please sign in again.');
  }
  if (new Date(row.expires_at).getTime() < Date.now()) throw unauthorized('Session expired. Please sign in again.');
  // Atomic claim: a concurrent refresh with the same token loses and is rejected.
  const claimed = await queryOne(`update public.auth_sessions set revoked_at = now(), rotated_at = now() where id = $1 and revoked_at is null returning id`, [row.id]);
  if (!claimed) throw unauthorized('Session expired. Please sign in again.');
  return { userId: row.user_id, session: await issueSession(row.user_id, scope, meta) };
}

export async function revokeRefreshSession(token: string): Promise<void> {
  await query(`update public.auth_sessions set revoked_at = now() where refresh_token_hash = $1 and revoked_at is null`, [sha256(token)]);
}

export async function revokeAllSessions(userId: string, exceptToken?: string, db: Db = pool): Promise<void> {
  await query(
    `update public.auth_sessions set revoked_at = now() where user_id = $1 and revoked_at is null and ($2::text is null or refresh_token_hash <> $2)`,
    [userId, exceptToken ? sha256(exceptToken) : null],
    db,
  );
}

// ─── Refresh cookie ─────────────────────────────────────────────────────────
export const cookieName = (scope: TokenScope) => (scope === 'admin' ? 'sportx_admin_rt' : 'sportx_rt');

function cookieOptions(expiresAt?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/api/v1',
    ...(expiresAt ? { expires: new Date(expiresAt) } : {}),
  };
}

export function setRefreshCookie(res: Response, scope: TokenScope, token: string, expiresAt: number, persistent = true) {
  // Non-persistent ("remember me" unticked) → session cookie, cleared when the browser closes.
  res.cookie(cookieName(scope), token, cookieOptions(persistent ? expiresAt : undefined));
}

export function clearRefreshCookie(res: Response, scope: TokenScope) {
  res.clearCookie(cookieName(scope), cookieOptions());
}

export function readRefreshCookie(req: Request, scope: TokenScope): string | undefined {
  const v = (req.cookies as Record<string, string> | undefined)?.[cookieName(scope)];
  return typeof v === 'string' && v.length > 20 ? v : undefined;
}
