import rateLimit, { type Options } from 'express-rate-limit';
import { env, isTest } from '../config/env.js';

const handler: Options['handler'] = (req, res) => {
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.', requestId: req.id },
  });
};

const make = (windowMs: number, limit: number, keyPrefix: string) =>
  rateLimit({
    windowMs,
    // Tests are unlimited; local development gets 10× headroom; production uses the strict limits.
    limit: isTest ? 10_000 : env.NODE_ENV === 'development' ? limit * 10 : limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler,
    // In-memory store: fine for one instance. Use a shared store (e.g. Redis) when scaling horizontally.
    keyGenerator: (req) => `${keyPrefix}:${req.ip}`,
  });

export const generalLimiter = make(60_000, 300, 'api');
export const authLimiter = make(15 * 60_000, 20, 'auth');
export const passwordResetLimiter = make(60 * 60_000, 5, 'pwreset');
export const couponLimiter = make(60_000, 20, 'coupon');
export const paymentLimiter = make(60_000, 15, 'payment');
export const reviewLimiter = make(60 * 60_000, 10, 'review');
export const writeLimiter = make(60_000, 60, 'write');
