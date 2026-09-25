import { z } from 'zod';
import { email, password, personName, phone } from '../auth/auth.schema.js';

export const updateMeSchema = z
  .object({
    firstName: personName.optional(),
    lastName: personName.optional(),
    phone: phone.nullish().or(z.literal('')),
    marketingOptIn: z.boolean().optional(),
    email: email.optional(),
    /** Required when changing the email address. */
    currentPassword: z.string().min(1).max(128).optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== 'currentPassword'), { message: 'Nothing to update.' });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
  })
  .refine((v) => v.currentPassword !== v.newPassword, { message: 'The new password must be different from the current one.', path: ['newPassword'] });

export const deleteMeSchema = z.object({ password: z.string().min(1).max(128) });
