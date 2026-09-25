import type { Customer, CustomerActivity, CustomerAddress, CustomerGroup, CustomerInput, CustomerOrder, CustomerStatus, ListParams, OrderStatus, Paginated } from '@/types';
import { adminApi, ApiError, type Query } from './api';

/* ─── Shared helpers (also used by reviewService / supportService) ─────────────────────────── */

export const lower = <T extends string>(v: string | null | undefined, fallback: T): T => (v ? (v.toLowerCase() as T) : fallback);
export const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

/** Column id → server `sort` key; unknown ids fall back to the server default. */
export function sortQuery(map: Record<string, string>, sortBy?: string, sortDir?: 'asc' | 'desc'): Query {
  const key = sortBy ? (map[sortBy] ?? (Object.values(map).includes(sortBy) ? sortBy : undefined)) : undefined;
  return key ? { sort: key, order: sortDir ?? 'desc' } : {};
}

/**
 * Flattens `ApiError.details` into `{ field: message }`. Handles the validation middleware's
 * `{ body: { fieldErrors } }` shape and service errors that return `{ fieldErrors }` directly.
 */
export function fieldErrorsOf(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.details || typeof err.details !== 'object') return {};
  const out: Record<string, string> = {};
  const take = (fe: unknown) => {
    if (!fe || typeof fe !== 'object') return;
    for (const [k, v] of Object.entries(fe as Record<string, unknown>)) {
      const msg = Array.isArray(v) ? v[0] : v;
      if (typeof msg === 'string' && !out[k]) out[k] = msg;
    }
  };
  const d = err.details as Record<string, { fieldErrors?: unknown } | unknown>;
  take((d as { fieldErrors?: unknown }).fieldErrors);
  for (const part of ['body', 'query', 'params']) take((d[part] as { fieldErrors?: unknown } | undefined)?.fieldErrors);
  return out;
}

/* ─── API DTOs ─────────────────────────────────────────────────────────────────────────────── */

interface CustomerRowDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  status: string;
  ordersCount: number;
  totalSpent: number;
  averageOrder: number;
  lastOrderAt: string | null;
  lastLoginAt: string | null;
  city: string | null;
  joinedAt: string;
  groups: string[];
}

interface CustomerDetailDto extends CustomerRowDto {
  marketingOptIn: boolean;
  notes: string | null;
  stats: { cancelledOrders: number; refundedTotal: number; reviews: number; tickets: number; openTickets: number };
  addresses: {
    id: string;
    label: string | null;
    fullName: string;
    phone: string | null;
    line1: string;
    line2: string | null;
    district: string | null;
    city: string;
    country: string;
    postalCode: string | null;
    isDefault: boolean;
  }[];
  wishlist: { count: number; items: { productId: string; name: string; slug: string; price: number; status: string; image: string | null; addedAt: string | null }[] };
  wishlistProductIds: string[];
}

export interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  itemsCount: number;
  grandTotal: number;
  image: string | null;
  placedAt: string;
}

interface ActivityDto {
  id: string;
  customerId: string;
  type: string;
  title: string;
  description: string | null;
  link: string | null;
  createdAt: string;
}

/* ─── Mappers ──────────────────────────────────────────────────────────────────────────────── */

function toCustomer(d: CustomerRowDto): Customer {
  return {
    id: d.id,
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    phone: d.phone ?? '',
    avatarUrl: opt(d.avatarUrl),
    status: lower<CustomerStatus>(d.status, 'active'),
    groups: (d.groups ?? []).map((g) => g.toLowerCase() as CustomerGroup),
    ordersCount: d.ordersCount,
    totalSpent: d.totalSpent,
    averageOrder: d.averageOrder,
    lastOrderAt: opt(d.lastOrderAt),
    lastLoginAt: opt(d.lastLoginAt),
    city: opt(d.city),
    joinedAt: d.joinedAt,
    addresses: [],
    wishlistProductIds: [],
    marketingOptIn: false,
  };
}

function toCustomerDetail(d: CustomerDetailDto): Customer {
  const addresses: CustomerAddress[] = (d.addresses ?? []).map((a) => ({
    id: a.id,
    label: a.label ?? 'Address',
    fullName: a.fullName,
    phone: a.phone ?? '',
    line1: a.line1,
    line2: opt(a.line2),
    district: opt(a.district),
    city: a.city,
    country: a.country,
    postalCode: opt(a.postalCode),
    isDefault: a.isDefault,
  }));
  return {
    ...toCustomer(d),
    addresses,
    marketingOptIn: d.marketingOptIn,
    notes: opt(d.notes),
    stats: d.stats,
    wishlistProductIds: d.wishlistProductIds ?? [],
    wishlist: (d.wishlist?.items ?? []).map((w) => ({ productId: w.productId, name: w.name, slug: w.slug, price: w.price, status: w.status.toLowerCase(), image: opt(w.image), addedAt: opt(w.addedAt) })),
  };
}

export function toCustomerOrder(o: OrderSummaryDto): CustomerOrder {
  return {
    id: o.id,
    number: o.orderNumber,
    status: lower<OrderStatus>(o.status, 'pending' as OrderStatus),
    paymentStatus: (o.paymentStatus ?? '').toLowerCase(),
    itemsCount: o.itemsCount,
    total: o.grandTotal,
    image: opt(o.image),
    createdAt: o.placedAt,
  };
}

/* ─── Public API ───────────────────────────────────────────────────────────────────────────── */

export interface CustomerFilters {
  status?: CustomerStatus | '';
  group?: CustomerGroup | '';
  city?: string;
}

export interface CustomerListParams extends ListParams {
  filters?: CustomerFilters;
}

/** Group ids match the server's computed segments (`GET /admin/customers/groups`). */
export const CUSTOMER_GROUPS: { id: CustomerGroup; label: string; description: string; rule: string }[] = [
  { id: 'all', label: 'All Customers', description: 'Every registered customer.', rule: 'All accounts' },
  { id: 'new', label: 'New Customers', description: 'Joined in the last 30 days.', rule: 'Joined ≤ 30 days ago' },
  { id: 'returning', label: 'Returning', description: 'Placed two or more orders.', rule: 'Orders ≥ 2' },
  { id: 'high_value', label: 'High Value', description: 'Lifetime spend of DJF 80,000 or more.', rule: 'Total spent ≥ DJF 80,000' },
  { id: 'inactive', label: 'Inactive', description: 'No order in the last 60 days.', rule: 'No order in 60 days' },
];

export interface CustomerGroupSummary {
  id: CustomerGroup;
  count: number;
  revenue: number;
  rule: string;
}

/** Table column id → server sort key. */
const CUSTOMER_SORT: Record<string, string> = { name: 'name', orders: 'orders_count', spent: 'total_spent', lastOrder: 'last_order_at', joined: 'joined_at' };

export const customerService = {
  /** GET /admin/customers — server-side search, filters, sort and pagination. */
  async getCustomers({ page = 1, pageSize = 25, search, sortBy, sortDir, filters = {} }: CustomerListParams = {}, signal?: AbortSignal): Promise<Paginated<Customer>> {
    const res = await adminApi.page<CustomerRowDto>(
      '/customers',
      {
        page,
        limit: pageSize,
        search: search?.trim() || undefined,
        status: filters.status || undefined,
        group: filters.group && filters.group !== 'all' ? filters.group : undefined,
        city: filters.city || undefined,
        ...sortQuery(CUSTOMER_SORT, sortBy, sortDir),
      },
      signal,
    );
    return { data: res.data.map(toCustomer), total: res.pagination.total, page: res.pagination.page, pageSize: res.pagination.limit };
  },

  /** GET /admin/customers/:id */
  async getCustomer(id: string): Promise<Customer> {
    return toCustomerDetail(await adminApi.get<CustomerDetailDto>(`/customers/${id}`));
  },

  /** PATCH /admin/customers/:id — profile fields only (see `setStatus`). */
  async updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
    const body = {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone.trim() || null,
      marketingOptIn: input.marketingOptIn,
      notes: input.notes?.trim() || null,
    };
    return toCustomerDetail(await adminApi.patch<CustomerDetailDto>(`/customers/${id}`, body));
  },

  /** PATCH /admin/customers/:id/status — blocking/deactivating signs the customer out everywhere. */
  async setStatus(id: string, status: CustomerStatus, reason?: string): Promise<Customer> {
    return toCustomerDetail(await adminApi.patch<CustomerDetailDto>(`/customers/${id}/status`, { status: status.toUpperCase(), reason: reason || undefined }));
  },

  /** GET /admin/customers/groups — counts and lifetime revenue per computed segment. */
  async getGroupSummary(): Promise<CustomerGroupSummary[]> {
    const rows = await adminApi.get<{ id: string; count: number; revenue: number; rule: string }[]>('/customers/groups');
    return rows.map((r) => ({ id: r.id.toLowerCase() as CustomerGroup, count: r.count, revenue: Number(r.revenue) || 0, rule: r.rule }));
  },

  /** GET /admin/customers/:id/activity */
  async getActivity(id: string): Promise<CustomerActivity[]> {
    const rows = await adminApi.get<ActivityDto[]>(`/customers/${id}/activity`);
    return rows.map((a) => ({
      id: a.id,
      customerId: a.customerId,
      type: a.type as CustomerActivity['type'],
      title: a.title,
      description: opt(a.description),
      link: opt(a.link),
      createdAt: a.createdAt,
    }));
  },

  /** GET /admin/customers/:id/orders — newest first. */
  async getCustomerOrders(id: string, { page = 1, pageSize = 5 }: { page?: number; pageSize?: number } = {}): Promise<Paginated<CustomerOrder>> {
    const res = await adminApi.page<OrderSummaryDto>(`/customers/${id}/orders`, { page, limit: pageSize });
    return { data: res.data.map(toCustomerOrder), total: res.pagination.total, page: res.pagination.page, pageSize: res.pagination.limit };
  },
};
