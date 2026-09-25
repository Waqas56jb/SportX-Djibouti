import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Development: logs the email (subject + recipient + links) instead of sending it. */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  readonly outbox: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.outbox.push(message);
    if (this.outbox.length > 50) this.outbox.shift();
    logger.info({ to: message.to, subject: message.subject, text: message.text }, 'email (console provider)');
  }
}

class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  async send(message: EmailMessage) {
    await this.transport.sendMail({ from: env.EMAIL_FROM, ...message });
  }
}

class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  async send(message: EmailMessage) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}`);
  }
}

export function createEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'smtp':
      return new SmtpEmailProvider();
    case 'resend':
      return new ResendEmailProvider();
    default:
      return new ConsoleEmailProvider();
  }
}

export { ConsoleEmailProvider };
