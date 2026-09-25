import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { isTest } from '../../config/env.js';
import { query, queryOne } from '../../config/database.js';
import { asyncHandler } from '../../utils/http.js';
import { created, ok } from '../../utils/apiResponse.js';
import { validate } from '../../middleware/validation.middleware.js';
import { email, phone } from '../auth/auth.schema.js';

/** Public form limiter (per IP). TODO: move to rateLimit.middleware as `publicFormLimiter`. */
const publicFormLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: isTest ? 10_000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `form:${req.ip}`,
  handler: (req, res) => {
    res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.', requestId: req.id } });
  },
});

const newsletterSchema = z.object({ email });
const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(120),
  email,
  phone: phone.optional().or(z.literal('')).transform((v) => v || null),
  subject: z.string().trim().max(160).optional(),
  message: z.string().trim().min(5, 'Please include a message.').max(5000),
});

/** POST /api/v1/newsletter → { alreadySubscribed }. */
export const newsletterRouter = Router();
newsletterRouter.post(
  '/',
  publicFormLimiter,
  validate({ body: newsletterSchema }),
  asyncHandler(async (req, res) => {
    const row = await queryOne<{ id: string }>(`insert into public.newsletter_subscribers (email) values ($1) on conflict do nothing returning id`, [req.body.email]);
    const alreadySubscribed = !row;
    return ok(res, { alreadySubscribed }, alreadySubscribed ? 'You are already subscribed.' : 'Thanks for subscribing!');
  }),
);

/** POST /api/v1/contact — stored in contact_messages for the team. */
export const contactRouter = Router();
contactRouter.post(
  '/',
  publicFormLimiter,
  validate({ body: contactSchema }),
  asyncHandler(async (req, res) => {
    const message = req.body.subject ? `[${req.body.subject}] ${req.body.message}` : req.body.message;
    await query(`insert into public.contact_messages (name, email, phone, message) values ($1, $2, $3, $4)`, [req.body.name, req.body.email, req.body.phone, message.slice(0, 5000)]);
    return created(res, { received: true }, 'Thanks — we will get back to you soon.');
  }),
);
