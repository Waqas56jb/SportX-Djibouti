import { z } from 'zod';

export const addressSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, 'Enter a valid phone number.'),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  district: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80).default('Djibouti'),
  postalCode: z.string().trim().max(20).optional().nullable(),
});

export const paymentMethodSchema = z.enum(['CARD', 'MOBILE_MONEY', 'CASH_ON_DELIVERY', 'BANK_TRANSFER']);

export const createOrderSchema = z
  .object({
    addressId: z.string().uuid().optional(),
    address: addressSchema.optional(),
    shippingMethod: z.string().trim().min(2).max(40),
    paymentMethod: paymentMethodSchema,
    couponCode: z.string().trim().max(32).optional().nullable(),
    customerNote: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => !(v.addressId && v.address), { message: 'Provide either addressId or address, not both.', path: ['address'] });

export const checkoutValidateSchema = z.object({
  shippingMethod: z.string().trim().min(2).max(40).optional(),
  couponCode: z.string().trim().max(32).optional().nullable(),
  addressId: z.string().uuid().optional(),
  address: addressSchema.partial().optional(),
  paymentMethod: paymentMethodSchema.optional(),
});

export const listOrdersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['active', 'delivered', 'cancelled', 'all']).default('all'),
});

export const cancelSchema = z.object({ reason: z.string().trim().max(300).optional().nullable() });
