import type { Campaign, CampaignInput, CampaignStatus, CampaignType, MarketingPage } from '@/types';
import { adminApi } from './api';

/**
 * Storefront campaigns — /api/v1/admin/campaigns. Statuses are UPPER_SNAKE on the wire
 * (DRAFT, ACTIVE …); the banner is managed through its own upload / delete endpoints.
 */

interface ApiCampaign {
  id: string;
  name: string;
  type: string;
  description: string;
  bannerUrl: string | null;
  productIds: string[];
  categoryIds: string[];
  startsAt: string;
  endsAt: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  revenue: number;
  unitsSold: number;
  createdAt: string;
  updatedAt: string;
}

const toCampaign = (c: ApiCampaign): Campaign => ({
  id: c.id,
  name: c.name,
  type: c.type.toLowerCase() as CampaignType,
  description: c.description ?? '',
  bannerUrl: c.bannerUrl ?? undefined,
  productIds: c.productIds ?? [],
  categoryIds: c.categoryIds ?? [],
  startsAt: c.startsAt,
  endsAt: c.endsAt,
  status: c.status.toLowerCase() as CampaignStatus,
  impressions: c.impressions ?? 0,
  clicks: c.clicks ?? 0,
  ctr: c.ctr ?? 0,
  revenue: Number(c.revenue ?? 0),
  unitsSold: c.unitsSold ?? 0,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const body = (i: CampaignInput) => ({
  name: i.name.trim(),
  type: i.type,
  description: i.description.trim(),
  productIds: i.productIds,
  categoryIds: i.categoryIds,
  startsAt: i.startsAt,
  endsAt: i.endsAt,
  status: i.status.toUpperCase(),
});

export type CampaignSort = 'starts_at' | 'ends_at' | 'created_at' | 'name' | 'status';

export interface CampaignListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CampaignStatus;
  type?: CampaignType;
  sort?: CampaignSort;
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}

const STATUSES: CampaignStatus[] = ['draft', 'scheduled', 'active', 'paused', 'archived', 'ended'];
export type CampaignCounts = Record<CampaignStatus | 'all', number>;

export const campaignService = {
  /** GET /admin/campaigns — server paging, search (name/description), status, type, sort. */
  async getCampaigns(p: CampaignListParams = {}): Promise<MarketingPage<Campaign>> {
    const r = await adminApi.page<ApiCampaign>(
      '/campaigns',
      { page: p.page ?? 1, limit: p.pageSize ?? 12, search: p.search?.trim() || undefined, status: p.status?.toUpperCase(), type: p.type, sort: p.sort, order: p.order },
      p.signal,
    );
    return { items: r.data.map(toCampaign), page: r.pagination.page, pageSize: r.pagination.limit, total: r.pagination.total, totalPages: r.pagination.totalPages };
  },

  /** Totals per status via `limit=1` requests (the list endpoint has no counts). */
  async getCounts(): Promise<CampaignCounts> {
    const all = [undefined, ...STATUSES];
    const totals = await Promise.all(all.map((s) => adminApi.page<unknown>('/campaigns', { page: 1, limit: 1, status: s?.toUpperCase() }).then((r) => r.pagination.total)));
    const out = {} as CampaignCounts;
    all.forEach((s, i) => (out[s ?? 'all'] = totals[i]));
    return out;
  },

  /** GET /admin/campaigns/:id */
  async getCampaign(id: string): Promise<Campaign> {
    return toCampaign(await adminApi.get<ApiCampaign>(`/campaigns/${id}`));
  },

  /** POST /admin/campaigns */
  async createCampaign(input: CampaignInput): Promise<Campaign> {
    return toCampaign(await adminApi.post<ApiCampaign>('/campaigns', body(input)));
  },

  /** PUT /admin/campaigns/:id */
  async updateCampaign(id: string, input: CampaignInput): Promise<Campaign> {
    return toCampaign(await adminApi.put<ApiCampaign>(`/campaigns/${id}`, body(input)));
  },

  /** PATCH /admin/campaigns/:id/status */
  async setStatus(id: string, status: CampaignStatus): Promise<Campaign> {
    return toCampaign(await adminApi.patch<ApiCampaign>(`/campaigns/${id}/status`, { status: status.toUpperCase() }));
  },

  /** POST /admin/campaigns/:id/banner (multipart, field "file") */
  async uploadBanner(id: string, file: File): Promise<Campaign> {
    return toCampaign(await adminApi.upload<ApiCampaign>(`/campaigns/${id}/banner`, file));
  },

  /** DELETE /admin/campaigns/:id/banner */
  async removeBanner(id: string): Promise<Campaign> {
    return toCampaign(await adminApi.delete<ApiCampaign>(`/campaigns/${id}/banner`));
  },

  /** DELETE /admin/campaigns/:id (also removes the stored banner) */
  async deleteCampaign(id: string): Promise<void> {
    await adminApi.delete(`/campaigns/${id}`);
  },
};
