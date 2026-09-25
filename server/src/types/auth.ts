import type { UUID } from './common.js';

export type PermissionKey = `${string}:${string}`;

/** Identity resolved server-side from the access token on every request. Never from client input. */
export interface AuthContext {
  userId: UUID;
  authUserId: UUID | null;
  email: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  emailVerified: boolean;
  roles: string[];
  permissions: Set<string>;
  isStaff: boolean;
  /** Which app the token was issued for. Admin APIs require an admin-scoped token. */
  scope: 'customer' | 'admin';
}

export interface IssuedSession {
  accessToken: string;
  /** Unix ms. */
  expiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthContext;
      /** Query string after Zod validation/coercion. */
      validatedQuery?: unknown;
    }
  }
}
