import type {
  AdminStatus,
  CampaignStatus,
  CustomerStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  PromotionStatus,
  ReviewStatus,
  ShippingStatus,
  StockStatus,
  TicketPriority,
  TicketStatus,
  Tone,
} from '@/types';

export interface StatusMeta {
  label: string;
  tone: Tone;
}

type Meta<K extends string> = Record<K, StatusMeta>;

export const ORDER_STATUS: Meta<OrderStatus> = {
  pending: { label: 'Pending', tone: 'warning' },
  processing: { label: 'Processing', tone: 'info' },
  packed: { label: 'Packed', tone: 'info' },
  shipped: { label: 'Shipped', tone: 'brand' },
  out_for_delivery: { label: 'Out for Delivery', tone: 'brand' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  refunded: { label: 'Refunded', tone: 'danger' },
};

/** Forward fulfilment flow, used for the status stepper and "next status" actions. */
export const ORDER_FLOW: OrderStatus[] = ['pending', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

export const PAYMENT_STATUS: Meta<PaymentStatus> = {
  pending: { label: 'Pending', tone: 'warning' },
  authorized: { label: 'Authorized', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  refund_pending: { label: 'Refund Pending', tone: 'warning' },
  refunded: { label: 'Refunded', tone: 'muted' },
  partially_refunded: { label: 'Partially Refunded', tone: 'info' },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  card: 'Card',
  mobile_money: 'Mobile Money',
  cash_on_delivery: 'Cash on Delivery',
  bank_transfer: 'Bank Transfer',
};

export const SHIPPING_STATUS: Meta<ShippingStatus> = {
  not_shipped: { label: 'Not Shipped', tone: 'muted' },
  label_created: { label: 'Label Created', tone: 'info' },
  in_transit: { label: 'In Transit', tone: 'brand' },
  out_for_delivery: { label: 'Out for Delivery', tone: 'brand' },
  delivered: { label: 'Delivered', tone: 'success' },
  returned: { label: 'Returned', tone: 'danger' },
};

export const PRODUCT_STATUS: Meta<ProductStatus> = {
  published: { label: 'Published', tone: 'success' },
  draft: { label: 'Draft', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'muted' },
};

export const STOCK_STATUS: Meta<StockStatus> = {
  in_stock: { label: 'In Stock', tone: 'success' },
  low_stock: { label: 'Low Stock', tone: 'warning' },
  out_of_stock: { label: 'Out of Stock', tone: 'danger' },
};

export const CUSTOMER_STATUS: Meta<CustomerStatus> = {
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'muted' },
  blocked: { label: 'Blocked', tone: 'danger' },
};

export const REVIEW_STATUS: Meta<ReviewStatus> = {
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  hidden: { label: 'Hidden', tone: 'muted' },
};

export const TICKET_STATUS: Meta<TicketStatus> = {
  open: { label: 'Open', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'brand' },
  waiting_customer: { label: 'Waiting for Customer', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  closed: { label: 'Closed', tone: 'muted' },
};

export const TICKET_PRIORITY: Meta<TicketPriority> = {
  low: { label: 'Low', tone: 'muted' },
  normal: { label: 'Normal', tone: 'neutral' },
  high: { label: 'High', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'danger' },
};

export const PROMOTION_STATUS: Meta<PromotionStatus> = {
  active: { label: 'Active', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  expired: { label: 'Expired', tone: 'muted' },
  disabled: { label: 'Disabled', tone: 'neutral' },
};

export const CAMPAIGN_STATUS: Meta<CampaignStatus> = {
  draft: { label: 'Draft', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  archived: { label: 'Archived', tone: 'muted' },
  ended: { label: 'Ended', tone: 'muted' },
};

export const ADMIN_STATUS: Meta<AdminStatus> = {
  active: { label: 'Active', tone: 'success' },
  invited: { label: 'Invited', tone: 'info' },
  deactivated: { label: 'Deactivated', tone: 'muted' },
};

export const ENABLED_STATUS: Meta<'active' | 'inactive'> = {
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'muted' },
};
