import { env } from '../../../config/env.js';
import { localProvider } from './local.provider.js';
import { supabaseProvider } from './supabase.provider.js';
import type { CredentialProvider } from './types.js';

export const credentials: CredentialProvider = env.AUTH_PROVIDER === 'local' ? localProvider : supabaseProvider;
export type { CredentialProvider };
