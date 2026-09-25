import type { ContactPayload } from '@/types';
import { apiClient } from './api/client';
import { USE_MOCK_API } from './config';
import { MockError, db, delay } from './mock/db';

export const marketingService = {
  async subscribeNewsletter(email: string): Promise<{ alreadySubscribed: boolean }> {
    if (!USE_MOCK_API) return apiClient.post<{ alreadySubscribed: boolean }>('/newsletter', { email });
    await delay(400, 700);
    const normalised = email.trim().toLowerCase();
    const alreadySubscribed = db.read().newsletter.includes(normalised);
    if (!alreadySubscribed) db.write((d) => void d.newsletter.push(normalised));
    return { alreadySubscribed };
  },

  async sendContactMessage(payload: ContactPayload): Promise<void> {
    if (!USE_MOCK_API) return apiClient.post<void>('/contact', payload);
    await delay(600, 1000);
    if (!payload.message.trim()) throw new MockError('Please include a message.');
  },
};
