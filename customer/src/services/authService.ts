import type { LoginPayload, ProfileUpdate, RegisterPayload, RegisterResult, User } from '@/types';
import { t, type TKey } from '@/i18n';
import { ApiError, api, localizeApiError, request, tokenStore } from './api';

interface SessionResponse {
  user: User;
  accessToken?: string;
  expiresAt?: string;
  requiresEmailVerification?: boolean;
}

function startSession(res: SessionResponse) {
  if (res.accessToken) tokenStore.set(res.accessToken, res.expiresAt);
  return res.user;
}

// ─── Error mapping ──────────────────────────────────────────────────────────

type FlatErrors = { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };

/**
 * Field messages from a VALIDATION_ERROR. The API sends either `{ fieldErrors }` or
 * `{ body: { fieldErrors }, query: … }` (zod `flatten()` per request part).
 */
export function apiFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR' || !error.details || typeof error.details !== 'object') return {};
  const details = error.details as FlatErrors & Record<string, FlatErrors>;
  const sources = [details, details.body, details.query, details.params].filter(Boolean) as FlatErrors[];
  const out: Record<string, string> = {};
  for (const src of sources) {
    for (const [field, messages] of Object.entries(src.fieldErrors ?? {})) {
      if (messages?.[0] && !out[field]) out[field] = messages[0];
    }
  }
  return out;
}

/** First form-level validation message, if any (e.g. zod `.refine` without a path). */
function apiFormError(error: ApiError): string | undefined {
  const details = error.details as (FlatErrors & Record<string, FlatErrors>) | undefined;
  return details?.formErrors?.[0] ?? details?.body?.formErrors?.[0];
}

/**
 * The API answers in English. Messages we know are mapped to the current language; anything else
 * is shown as sent (it is usually specific and still useful).
 */
const KNOWN_MESSAGES: Record<string, TKey> = {
  'Incorrect email or password.': 'auth.errors.invalidCredentials',
  'Your current password is incorrect.': 'auth.errors.wrongCurrentPassword',
  'Your password is incorrect.': 'auth.errors.wrongPassword',
  'This account has been blocked.': 'auth.errors.accountBlocked',
  'This account has been blocked. Please contact SPORTX.': 'auth.errors.accountBlocked',
  'This account is inactive.': 'auth.errors.accountInactive',
  'This account is inactive. Please contact SPORTX.': 'auth.errors.accountInactive',
  'Too many requests. Please wait a moment and try again.': 'auth.errors.rateLimited',
  'We could not reach SPORTX. Check your connection and try again.': 'auth.errors.network',
  'Something went wrong on our side. Please try again.': 'auth.errors.server',
  'Authentication required.': 'auth.errors.signInRequired',
};

/** Translates a known API message; returns other messages unchanged. */
export const localizeApiMessage = (message: string): string => {
  const key = KNOWN_MESSAGES[message.trim()];
  return key ? t(key) : message;
};

/** Friendly, user-facing message for an API error (form banners and toasts). */
export function friendlyError(error: unknown, fallback?: string): string {
  const fb = fallback ?? t('auth.errors.generic');
  if (!(error instanceof ApiError)) return error instanceof Error && error.message ? localizeApiMessage(error.message) : fb;
  switch (error.code) {
    case 'UNAUTHORIZED':
      return error.message && !/token|session/i.test(error.message) ? localizeApiMessage(error.message) : t('auth.errors.invalidCredentials');
    case 'EMAIL_NOT_VERIFIED':
      return t('auth.errors.emailNotVerified');
    case 'ACCOUNT_INACTIVE':
      return error.message ? localizeApiMessage(error.message) : t('auth.errors.accountInactive');
    case 'RATE_LIMITED':
      return t('auth.errors.rateLimited');
    case 'NETWORK_ERROR':
      return t('auth.errors.network');
    case 'VALIDATION_ERROR': {
      const fields = Object.values(apiFieldErrors(error));
      if (error.message && error.message !== 'Request validation failed.')
        return KNOWN_MESSAGES[error.message.trim()] ? localizeApiMessage(error.message) : localizeApiError(error, fb);
      return apiFormError(error) ?? fields[0] ?? t('auth.errors.checkFields');
    }
    default:
      if (error.status >= 500) return t('auth.errors.server');
      if (!error.message) return fb;
      // Known auth messages first, then the shared API translator (codes/patterns) for FR/AR.
      return KNOWN_MESSAGES[error.message.trim()] ? localizeApiMessage(error.message) : localizeApiError(error, fb);
  }
}

// ─── Service ────────────────────────────────────────────────────────────────

export const authService = {
  async login(payload: LoginPayload): Promise<User> {
    const res = await request<SessionResponse>('/auth/login', { method: 'POST', body: { ...payload, email: payload.email.trim() }, noRefresh: true });
    return startSession(res);
  },

  /** Creates the account. When email verification is required no session is started. */
  async register(payload: RegisterPayload): Promise<RegisterResult> {
    const res = await request<SessionResponse>('/auth/register', {
      method: 'POST',
      body: { ...payload, email: payload.email.trim(), phone: payload.phone.trim() },
      noRefresh: true,
    });
    const requiresEmailVerification = Boolean(res.requiresEmailVerification) || !res.accessToken;
    if (!requiresEmailVerification) startSession(res);
    return { user: res.user, requiresEmailVerification };
  },

  /** Revokes the refresh cookie server-side; the in-memory token is always dropped. */
  async logout(): Promise<void> {
    try {
      await request<void>('/auth/logout', { method: 'POST', noRefresh: true });
    } finally {
      tokenStore.set(null);
    }
  },

  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.user),

  requestPasswordReset: (email: string) => request<void>('/auth/forgot-password', { method: 'POST', body: { email: email.trim() }, noRefresh: true }),

  resetPassword: (token: string, password: string) => request<void>('/auth/reset-password', { method: 'POST', body: { token, password }, noRefresh: true }),

  verifyEmail: (token: string) => request<{ user: User }>('/auth/verify-email', { method: 'POST', body: { token }, noRefresh: true }).then((r) => r.user),

  resendVerification: (email: string) => request<void>('/auth/resend-verification', { method: 'POST', body: { email: email.trim() }, noRefresh: true }),

  // Profile helpers kept here for existing callers; see accountService for the full profile API.
  updateProfile: (_userId: string, patch: ProfileUpdate) => api.patch<{ user: User }>('/users/me', patch).then((r) => r.user),

  changePassword: (_userId: string, currentPassword: string, newPassword: string) => api.patch<void>('/users/me/password', { currentPassword, newPassword }),
};
