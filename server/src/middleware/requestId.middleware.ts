import type { RequestHandler } from 'express';
import crypto from 'node:crypto';

/** Accepts a well-formed upstream X-Request-Id (from a proxy) or generates one; echoed in the response. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.id = incoming && /^[A-Za-z0-9._-]{8,80}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
