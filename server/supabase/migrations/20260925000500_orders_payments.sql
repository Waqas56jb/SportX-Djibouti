-- SPORTX — orders, items, status history, payments, refunds, shipping.
-- Orders and payments are never physically deleted (soft delete only).

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references public.users (id) on delete restrict,
  email text not null,
  phone text not null,
  customer_first_name text not null,
  customer_last_name text not null,
  status public.order_status not null default 'PENDING',
  payment_status public.payment_status not null default 'PENDING',
  payment_method public.payment_method not null,
  shipping_status public.shipping_status not null default 'PENDING',
  currency text not null default 'DJF',
  subtotal bigint not null check (subtotal >= 0),
  product_discount_total bigint not null default 0 check (product_discount_total >= 0),
  coupon_code text,
  coupon_discount bigint not null default 0 check (coupon_discount >= 0),
  shipping_total bigint not null default 0 check (shipping_total >= 0),
  tax_total bigint not null default 0 check (tax_total >= 0),
  grand_total bigint not null check (grand_total >= 0),
  refunded_total bigint not null default 0 check (refunded_total >= 0),
  items_count integer not null check (items_count > 0),
  shipping_method_id uuid references public.shipping_methods (id) on delete set null,
  shipping_method_code text not null,
  shipping_method_name text not null,
  shipping_address jsonb,
  customer_note text,
  idempotency_key text,
  inventory_state public.inventory_state not null default 'RESERVED',
  payment_expires_at timestamptz,
  placed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (refunded_total <= grand_total)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_created_idx on public.orders (created_at desc);
create unique index orders_idempotency_key on public.orders (user_id, idempotency_key) where idempotency_key is not null;
create index orders_pending_expiry_idx on public.orders (payment_expires_at) where status = 'PAYMENT_PENDING';
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

-- Immutable snapshots: the order must render correctly even if the product changes later.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  product_slug text not null,
  brand_name text not null,
  sku text not null,
  color text not null,
  size text not null,
  image_url text,
  original_unit_price bigint not null check (original_unit_price >= 0),
  unit_price bigint not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  discount_total bigint not null default 0 check (discount_total >= 0),
  line_total bigint not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  status public.order_status not null,
  note text,
  changed_by uuid references public.users (id) on delete set null,
  actor_type public.actor_type not null default 'SYSTEM',
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- Internal staff notes and non-status events (tracking added, refund issued …).
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  kind text not null,
  title text not null,
  description text,
  actor_id uuid references public.users (id) on delete set null,
  actor_type public.actor_type not null default 'SYSTEM',
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- No card numbers, CVV or provider secrets are ever stored.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null,
  method public.payment_method not null,
  status public.payment_status not null default 'PENDING',
  amount bigint not null check (amount >= 0),
  refunded_amount bigint not null default 0 check (refunded_amount >= 0),
  currency text not null default 'DJF',
  provider_payment_id text,
  idempotency_key text unique,
  failure_reason text,
  card_brand text,
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_amount <= amount)
);
create index payments_order_idx on public.payments (order_id);
create unique index payments_provider_ref_key on public.payments (provider, provider_payment_id) where provider_payment_id is not null;
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

create table public.payment_status_history (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  status public.payment_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index payment_status_history_payment_idx on public.payment_status_history (payment_id, created_at);

-- Webhook deliveries. unique(provider, event_id) makes processing idempotent.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  type text not null,
  payment_id uuid references public.payments (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete restrict,
  amount bigint not null check (amount > 0),
  reason text not null check (reason in ('CUSTOMER_REQUEST', 'DAMAGED_ITEM', 'WRONG_ITEM', 'PAYMENT_ISSUE', 'OTHER')),
  note text,
  status public.refund_status not null default 'REQUESTED',
  provider_reference text,
  restock boolean not null default false,
  idempotency_key text unique,
  requested_by uuid references public.users (id) on delete set null,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);
create trigger refunds_updated_at before update on public.refunds for each row execute function public.set_updated_at();

-- Fulfilment record, separate from payment status.
create table public.shipping (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  method_code text not null,
  carrier text,
  tracking_number text,
  status public.shipping_status not null default 'PENDING',
  cost bigint not null default 0 check (cost >= 0),
  estimated_delivery_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shipping_updated_at before update on public.shipping for each row execute function public.set_updated_at();

alter table public.coupon_usages add constraint coupon_usages_order_fk foreign key (order_id) references public.orders (id) on delete cascade;
alter table public.inventory_movements add constraint inventory_movements_order_fk foreign key (order_id) references public.orders (id) on delete set null;
