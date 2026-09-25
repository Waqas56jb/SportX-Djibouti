import type { Address, AppNotification, ProfileUpdate, User } from '@/types';
import { api } from './api';

/** Compact order row as returned by the dashboard (`toOrderSummary` on the API). */
export interface DashboardOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  shippingStatus: string;
  itemsCount: number;
  currency: string;
  grandTotal: number;
  refundedTotal: number;
  shippingMethod: string;
  image: string | null;
  placedAt: string;
  updatedAt: string;
}

export interface AccountDashboard {
  user: User;
  orderCounts: { total: number; active: number; pending: number; delivered: number; cancelled: number };
  recentOrders: DashboardOrder[];
  wishlistCount: number;
  addressesCount: number;
  defaultAddress: (Address & { addressLine1?: string }) | null;
  unreadNotifications: number;
  recentNotifications: AppNotification[];
  openTickets: number;
  reviewsCount: number;
}

/** The signed-in customer's profile and account overview (`/users/me`, `/account/dashboard`). */
export const accountService = {
  dashboard: (signal?: AbortSignal) => api.get<AccountDashboard>('/account/dashboard', undefined, signal),

  me: () => api.get<{ user: User }>('/users/me').then((r) => r.user),

  /** `currentPassword` is required by the API when the email changes. */
  updateProfile: (patch: ProfileUpdate) => api.patch<{ user: User }>('/users/me', patch).then((r) => r.user),

  uploadAvatar: (file: File) => api.upload<{ user: User }>('/users/me/avatar', file).then((r) => r.user),

  removeAvatar: () => api.delete<{ user: User }>('/users/me/avatar').then((r) => r.user),

  /** Other devices are signed out by the API; this session stays valid. */
  changePassword: (currentPassword: string, newPassword: string) => api.patch<void>('/users/me/password', { currentPassword, newPassword }),

  /** Permanently deletes the account (the API clears the refresh cookie). */
  deleteAccount: (password: string) => api.delete<void>('/users/me', { password }),
};
