export type UUID = string;
export type ISODate = string;

export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type ActorType = 'SYSTEM' | 'ADMIN' | 'CUSTOMER';

export type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'PROCESSING'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED';

export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'CANCELLED';
export type PaymentMethod = 'CARD' | 'MOBILE_MONEY' | 'CASH_ON_DELIVERY' | 'BANK_TRANSFER';
export type ShippingStatus = 'PENDING' | 'PACKED' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED';
export type RefundStatus = 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ProductGender = 'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX';
export type InventoryReason = 'RESTOCK' | 'MANUAL_ADJUSTMENT' | 'DAMAGED' | 'RETURNED' | 'ORDER' | 'ORDER_CANCELLED' | 'REFUND' | 'OTHER';

export type NotificationType =
  | 'ORDER_CREATED'
  | 'PAYMENT_CONFIRMED'
  | 'ORDER_PROCESSING'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'REFUND_PROCESSED'
  | 'SUPPORT_REPLY'
  | 'LOW_STOCK'
  | 'NEW_ORDER'
  | 'PAYMENT_FAILED'
  | 'REFUND_REQUESTED'
  | 'NEW_TICKET'
  | 'NEW_CUSTOMER'
  | 'REVIEW_PENDING';
