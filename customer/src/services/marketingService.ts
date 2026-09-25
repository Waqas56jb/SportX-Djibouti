import type { ContactPayload, NewsletterResult } from '@/types';
import { api } from './api';

/** Public forms: newsletter sign-up and the contact form. */
export const marketingService = {
  subscribeNewsletter: (email: string) => api.post<NewsletterResult>('/newsletter', { email: email.trim() }),

  async sendContactMessage(payload: ContactPayload): Promise<void> {
    await api.post<{ received: boolean }>('/contact', {
      name: payload.name.trim(),
      email: payload.email.trim(),
      phone: payload.phone?.trim() || '',
      subject: payload.subject?.trim() || undefined,
      message: payload.message.trim(),
    });
  },
};
