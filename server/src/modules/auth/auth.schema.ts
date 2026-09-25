import { z } from 'zod';
import { PASSWORD_RULE } from './password.js';

export const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
export const password = z.string().regex(PASSWORD_RULE, 'Password must be 8–128 characters and include a letter and a number.');
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,20}$/, 'Enter a valid phone number.');
export const personName = z.string().trim().min(1).max(80);

export const registerSchema = z.object({
  firstName: personName,
  lastName: personName,
  email,
  phone: phone.optional().or(z.literal('')),
  password,
  marketingOptIn: z.boolean().optional().default(false),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
  remember: z.boolean().optional().default(true),
});

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ token: z.string().min(10).max(4096), password });
export const verifyEmailSchema = z.object({ token: z.string().min(10).max(4096) });
