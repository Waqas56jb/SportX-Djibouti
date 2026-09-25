import pino from 'pino';

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info');
const pretty = process.env.NODE_ENV === 'development' && process.stdout.isTTY;

/**
 * Structured JSON logger. Sensitive fields are redacted at the source so passwords,
 * tokens, cookies and payment secrets never reach log storage.
 */
export const logger = pino({
  level,
  base: { service: 'sportx-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.newPassword',
      '*.currentPassword',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.secret',
      '*.cardNumber',
      '*.cvc',
    ],
    censor: '[redacted]',
  },
  transport: pretty ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } : undefined,
});
