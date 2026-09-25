import { logger } from '../../utils/logger.js';
import { jobs } from '../jobs.js';
import { createEmailProvider, type EmailProvider } from './email.provider.js';
import { render, type EmailTemplate } from './templates.js';

const provider: EmailProvider = createEmailProvider();

/**
 * Email is non-critical: sending is queued on the in-process job runner and failures are logged,
 * never rolling back the business operation that triggered them.
 */
export const emailService = {
  provider,

  /** Sends now and awaits delivery (auth flows where the caller wants to know). Errors are logged. */
  async send(template: EmailTemplate, to: string, vars: Record<string, string | number | undefined | null>): Promise<void> {
    try {
      await provider.send({ to, ...render(template, vars) });
    } catch (err) {
      logger.error({ err, template }, 'email delivery failed');
    }
  },

  /** Fire-and-forget. */
  queue(template: EmailTemplate, to: string, vars: Record<string, string | number | undefined | null>): void {
    jobs.enqueue(`email:${template}`, () => this.send(template, to, vars));
  },
};
