import { z } from 'zod';
import { phone, personName } from '../auth/auth.schema.js';
import { optionalText } from '../account/schema-helpers.js';

const line = z.string().trim().min(3, 'Enter the street address.').max(200);

/** Accepts `addressLine1` (API) or `line1` (storefront form) spelling. */
const normalise = (v: unknown) => {
  if (!v || typeof v !== 'object') return v;
  const o = { ...(v as Record<string, unknown>) };
  if (o.addressLine1 === undefined && o.line1 !== undefined) o.addressLine1 = o.line1;
  if (o.addressLine2 === undefined && o.line2 !== undefined) o.addressLine2 = o.line2;
  return o;
};

const fields = {
  label: z.string().trim().min(1).max(40),
  firstName: personName,
  lastName: personName,
  phone,
  addressLine1: line,
  addressLine2: optionalText(200),
  district: optionalText(80),
  city: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80),
  postalCode: optionalText(20),
  isDefault: z.boolean(),
};

export const createAddressSchema = z.preprocess(
  normalise,
  z.object({
    ...fields,
    label: fields.label.default('Home'),
    country: fields.country.default('Djibouti'),
    isDefault: fields.isDefault.default(false),
    addressLine2: fields.addressLine2.optional(),
    district: fields.district.optional(),
    postalCode: fields.postalCode.optional(),
  }),
);

export const updateAddressSchema = z.preprocess(
  normalise,
  z
    .object({
      label: fields.label.optional(),
      firstName: fields.firstName.optional(),
      lastName: fields.lastName.optional(),
      phone: fields.phone.optional(),
      addressLine1: fields.addressLine1.optional(),
      addressLine2: fields.addressLine2.optional(),
      district: fields.district.optional(),
      city: fields.city.optional(),
      country: fields.country.optional(),
      postalCode: fields.postalCode.optional(),
      isDefault: fields.isDefault.optional(),
    })
    .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' }),
);

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
