import type { Campaign, CampaignInput, CampaignStatus } from '@/types';
import { appConfig } from '@/constants/config';
import { uid } from '@/utils/id';
import { api, ApiError } from './http';
import { audit, db, delay, matches, NotFoundError, now } from './mock/db';

const ACTION_LABEL: Partial<Record<CampaignStatus, string>> = {
  active: 'Campaign activated',
  paused: 'Campaign paused',
  archived: 'Campaign archived',
  scheduled: 'Campaign scheduled',
  draft: 'Campaign moved to draft',
};

export const campaignService = {
  /** GET /campaigns */
  async getCampaigns(filters: { search?: string; status?: CampaignStatus | '' } = {}): Promise<Campaign[]> {
    if (!appConfig.useMocks) return api.get<Campaign[]>('/campaigns', { ...filters });
    const list = db.campaigns
      .filter((c) => matches([c.name, c.description], filters.search))
      .filter((c) => !filters.status || c.status === filters.status)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return delay(list);
  },

  /** GET /campaigns/:id */
  async getCampaign(id: string): Promise<Campaign> {
    if (!appConfig.useMocks) return api.get<Campaign>(`/campaigns/${id}`);
    const c = db.campaigns.find((x) => x.id === id);
    if (!c) throw new NotFoundError('Campaign');
    return delay(c);
  },

  /** POST /campaigns */
  async createCampaign(input: CampaignInput): Promise<Campaign> {
    if (!appConfig.useMocks) return api.post<Campaign>('/campaigns', input);
    if (input.endsAt <= input.startsAt) throw new ApiError('End date must be after start date.', 400);
    const c: Campaign = { ...input, id: uid('cmp'), impressions: 0, clicks: 0, revenue: 0, createdAt: now(), updatedAt: now() };
    db.campaigns.unshift(c);
    audit('Campaign created', 'Marketing', c.name, '/marketing/campaigns');
    return delay(c, 500);
  },

  /** PUT /campaigns/:id */
  async updateCampaign(id: string, input: CampaignInput): Promise<Campaign> {
    if (!appConfig.useMocks) return api.put<Campaign>(`/campaigns/${id}`, input);
    const c = db.campaigns.find((x) => x.id === id);
    if (!c) throw new NotFoundError('Campaign');
    Object.assign(c, input, { updatedAt: now() });
    audit('Campaign updated', 'Marketing', c.name, '/marketing/campaigns');
    return delay(c);
  },

  /** PATCH /campaigns/:id/status */
  async setStatus(id: string, status: CampaignStatus): Promise<Campaign> {
    if (!appConfig.useMocks) return api.patch<Campaign>(`/campaigns/${id}/status`, { status });
    const c = db.campaigns.find((x) => x.id === id);
    if (!c) throw new NotFoundError('Campaign');
    c.status = status;
    c.updatedAt = now();
    audit(ACTION_LABEL[status] ?? 'Campaign updated', 'Marketing', c.name, '/marketing/campaigns');
    return delay(c, 300);
  },

  /** DELETE /campaigns/:id */
  async deleteCampaign(id: string): Promise<void> {
    if (!appConfig.useMocks) return api.delete(`/campaigns/${id}`);
    const c = db.campaigns.find((x) => x.id === id);
    if (!c) throw new NotFoundError('Campaign');
    db.campaigns = db.campaigns.filter((x) => x.id !== id);
    audit('Campaign deleted', 'Marketing', c.name);
    await delay(null);
  },
};
