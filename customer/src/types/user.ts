export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

/** Public profile returned by the SPORTX API (`/auth/*`, `/users/me`). */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
  status?: AccountStatus;
  marketingOptIn: boolean;
  emailVerified?: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

/**
 * Client-side session. The access token lives in memory only (see services/api.ts) and the
 * refresh token is an HttpOnly cookie, so nothing secret is ever part of this object.
 */
export interface AuthSession {
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
  remember: boolean;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  marketingOptIn?: boolean;
}

export interface RegisterResult {
  user: User;
  /** True when the account must confirm its email before it can sign in (no session was started). */
  requiresEmailVerification: boolean;
}

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  marketingOptIn?: boolean;
  /** Required by the API when `email` changes. */
  currentPassword?: string;
}

export interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  line1: string;
  line2?: string;
  district?: string;
  city: string;
  country: string;
  postalCode?: string;
  isDefault: boolean;
}

export type AddressInput = Omit<Address, 'id'>;
