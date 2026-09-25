import { adminApi } from './api';

export type SearchGroup = 'products' | 'orders' | 'customers' | 'tickets' | 'categories';

export interface SearchResult {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle: string;
  meta?: string;
  to: string;
  image?: string;
}

interface ApiSearchResult extends Omit<SearchResult, 'image'> {
  image?: string | null;
}

export const searchService = {
  /**
   * GET /admin/search?q= — grouped results (max 5 per group). Each group is only searched when the
   * admin holds that module's view permission; queries shorter than 2 characters return nothing.
   */
  async search(query: string, limitPerGroup = 5, signal?: AbortSignal): Promise<SearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const rows = await adminApi.get<ApiSearchResult[]>('/search', { q: q.slice(0, 100), limit: Math.min(5, limitPerGroup) }, signal);
    return rows.map((r) => ({ ...r, image: r.image ?? undefined }));
  },
};
