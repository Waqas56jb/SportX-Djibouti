import type { Db } from '../../../config/database.js';

/**
 * Credential provider. Handles passwords, email verification and recovery only.
 * Sessions and access tokens are always issued by the API (see tokens.ts), so the rest of the
 * system is identical whichever provider is configured. OAuth providers (Google, Apple) can be
 * added later through Supabase Auth without touching business code.
 */
export interface CredentialProvider {
  readonly name: 'supabase' | 'local';

  /** Creates credentials for a new app user. Returns the auth.users id when the provider has one. */
  createCredentials(input: { userId: string; email: string; password: string; firstName: string; lastName: string }, db: Db): Promise<{ authUserId: string | null }>;

  /** Returns true when the password matches. Throws EMAIL_NOT_VERIFIED when the provider requires confirmation first. */
  verifyPassword(user: { id: string; authUserId: string | null; email: string }, password: string): Promise<boolean>;

  setPassword(user: { id: string; authUserId: string | null }, password: string, db: Db): Promise<void>;
  updateEmail(user: { id: string; authUserId: string | null }, email: string): Promise<void>;

  /** Sends a password-reset message. Must not reveal whether the account exists. */
  /** `app` decides which frontend the link opens (staff invites / resets go to the admin app). */
  sendPasswordReset(user: { id: string; email: string; firstName: string } | null, email: string, opts?: { app?: 'customer' | 'admin' }): Promise<void>;
  /** Validates a reset token; returns the app user id it belongs to. */
  consumePasswordReset(token: string): Promise<string>;

  sendEmailVerification(user: { id: string; email: string; firstName: string; authUserId: string | null }): Promise<void>;
  /** Validates a verification token; returns the app user id. */
  consumeEmailVerification(token: string): Promise<string>;

  deleteCredentials(user: { id: string; authUserId: string | null }): Promise<void>;
}
