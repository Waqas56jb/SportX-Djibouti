/** ISO-8601 timestamp string, e.g. "2026-09-25T08:30:00.000Z". Matches Postgres timestamptz JSON output. */
export type ISODate = string;
export type ID = string;

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export type DateRangePreset = 'today' | '7d' | '30d' | '3m' | '12m' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  from?: ISODate;
  to?: ISODate;
}

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'muted';
