import { z } from 'zod';
import { adminListQuery, paginationQuery } from '../../utils/pagination.js';
import { looseEnum, REVIEW_STATUSES } from '../account/schema-helpers.js';

/** Accepts `comment` (API) or `body` (storefront form). */
const withComment = (v: unknown) => {
  if (!v || typeof v !== 'object') return v;
  const o = { ...(v as Record<string, unknown>) };
  if (o.comment === undefined && o.body !== undefined) o.comment = o.body;
  return o;
};

const rating = z.coerce.number().int().min(1).max(5);
const title = z.string().trim().min(2, 'Add a short title.').max(120);
const comment = z.string().trim().min(10, 'Tell us a little more (at least 10 characters).').max(2000);
const fit = z.enum(['small', 'true', 'large']).nullish();
const size = z.string().trim().max(20).nullish();

export const createReviewSchema = z.preprocess(withComment, z.object({ rating, title, comment, fit, size }));

export const updateReviewSchema = z.preprocess(
  withComment,
  z
    .object({ rating: rating.optional(), title: title.optional(), comment: comment.optional(), fit, size })
    .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' }),
);

export const productReviewsQuery = paginationQuery(50, 10).extend({
  sort: z.enum(['newest', 'highest', 'lowest', 'helpful']).default('newest'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

const reviewStatus = looseEnum([...REVIEW_STATUSES] as [string, ...string[]]);

export const adminReviewsQuery = adminListQuery(['created_at', 'rating', 'helpful_count', 'moderated_at']).extend({
  status: reviewStatus.optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  productId: z.string().uuid().optional(),
  product: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
});

export const reviewStatusSchema = z.object({ status: reviewStatus });
export const bulkStatusSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200), status: reviewStatus });

export type ProductReviewsQuery = z.infer<typeof productReviewsQuery>;
export type AdminReviewsQuery = z.infer<typeof adminReviewsQuery>;
