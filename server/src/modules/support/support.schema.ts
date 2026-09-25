import { z } from 'zod';
import { adminListQuery, paginationQuery } from '../../utils/pagination.js';
import { looseEnum, TICKET_CATEGORIES, TICKET_CATEGORY_ALIASES, TICKET_PRIORITIES, TICKET_STATUSES } from '../account/schema-helpers.js';

export const ticketStatus = looseEnum([...TICKET_STATUSES] as [string, ...string[]]);
export const ticketPriority = looseEnum([...TICKET_PRIORITIES] as [string, ...string[]]);
export const ticketCategory = looseEnum([...TICKET_CATEGORIES] as [string, ...string[]], TICKET_CATEGORY_ALIASES);

const body = z.string().trim().min(1, 'Message cannot be empty.').max(5000);

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Add a subject.').max(160),
  category: ticketCategory.default('OTHER'),
  orderNumber: z
    .string()
    .trim()
    .max(40)
    .nullish()
    .transform((v) => (v ? v.toUpperCase() : null)),
  message: body,
});

export const customerReplySchema = z.object({ body });
export const customerListQuery = paginationQuery(50, 20).extend({ status: ticketStatus.optional() });

export const adminListTicketsQuery = adminListQuery(['updated_at', 'created_at', 'priority', 'status']).extend({
  status: ticketStatus.optional(),
  priority: ticketPriority.optional(),
  category: ticketCategory.optional(),
  /** Staff user id or "unassigned". */
  assignedToId: z.union([z.literal('unassigned'), z.string().uuid()]).optional(),
  assignee: z.union([z.literal('unassigned'), z.string().uuid()]).optional(),
  customerId: z.string().uuid().optional(),
});

export const adminStatusSchema = z.object({ status: ticketStatus });
export const adminPatchSchema = z
  .object({
    status: ticketStatus.optional(),
    priority: ticketPriority.optional(),
    assignedToId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.priority !== undefined || v.assignedToId !== undefined, { message: 'Nothing to update.' });
export const adminReplySchema = z.object({ body, internal: z.boolean().default(false) });

export type CustomerListQuery = z.infer<typeof customerListQuery>;
export type AdminListTicketsQuery = z.infer<typeof adminListTicketsQuery>;
