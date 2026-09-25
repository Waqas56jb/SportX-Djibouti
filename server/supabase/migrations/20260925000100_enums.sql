-- SPORTX — enumerated types.
-- Canonical status vocabularies shared by the customer and admin APIs.

create type public.user_status as enum ('ACTIVE', 'INACTIVE', 'BLOCKED');

create type public.product_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
create type public.product_gender as enum ('MEN', 'WOMEN', 'KIDS', 'UNISEX');
create type public.image_role as enum ('MAIN', 'GALLERY', 'HOVER');

create type public.inventory_reason as enum (
  'RESTOCK', 'MANUAL_ADJUSTMENT', 'DAMAGED', 'RETURNED',
  'ORDER', 'ORDER_CANCELLED', 'REFUND', 'OTHER'
);

create type public.discount_type as enum ('PERCENTAGE', 'FIXED');
create type public.discount_scope as enum ('ALL', 'PRODUCTS', 'CATEGORIES', 'BRANDS');

create type public.order_status as enum (
  'PENDING', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'PROCESSING', 'PACKED',
  'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUND_REQUESTED', 'REFUNDED'
);
create type public.payment_status as enum (
  'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED'
);
create type public.payment_method as enum ('CARD', 'MOBILE_MONEY', 'CASH_ON_DELIVERY', 'BANK_TRANSFER');
create type public.shipping_status as enum ('PENDING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED');
create type public.refund_status as enum ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED');
create type public.inventory_state as enum ('RESERVED', 'COMMITTED', 'RELEASED');
create type public.actor_type as enum ('SYSTEM', 'ADMIN', 'CUSTOMER');

create type public.review_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');

create type public.ticket_status as enum ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');
create type public.ticket_priority as enum ('LOW', 'NORMAL', 'HIGH', 'URGENT');
create type public.ticket_category as enum ('ORDER', 'DELIVERY', 'RETURNS', 'PAYMENT', 'PRODUCT', 'ACCOUNT', 'OTHER');

create type public.notification_audience as enum ('CUSTOMER', 'ADMIN');
create type public.notification_type as enum (
  -- customer-facing
  'ORDER_CREATED', 'PAYMENT_CONFIRMED', 'ORDER_PROCESSING', 'ORDER_SHIPPED', 'ORDER_DELIVERED',
  'ORDER_CANCELLED', 'REFUND_PROCESSED', 'SUPPORT_REPLY',
  -- staff-facing
  'LOW_STOCK', 'NEW_ORDER', 'PAYMENT_FAILED', 'REFUND_REQUESTED', 'NEW_TICKET', 'NEW_CUSTOMER', 'REVIEW_PENDING'
);

create type public.campaign_status as enum ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'ENDED');
create type public.auth_token_purpose as enum ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
