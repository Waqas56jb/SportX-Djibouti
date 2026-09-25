-- SPORTX — carts, wishlists, shipping configuration, store settings, promotions.

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  coupon_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger carts_updated_at before update on public.carts for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 10),
  -- Price at the time the item was added; used only to flag price changes, never to charge.
  unit_price_snapshot bigint not null check (unit_price_snapshot >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create index cart_items_cart_idx on public.cart_items (cart_id);
create trigger cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.wishlist_items (
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  regions text[] not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shipping_zones_updated_at before update on public.shipping_zones for each row execute function public.set_updated_at();

create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.shipping_zones (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9_-]+$'),
  name text not null,
  description text not null default '',
  price bigint not null check (price >= 0),
  free_shipping_threshold bigint check (free_shipping_threshold is null or free_shipping_threshold >= 0),
  min_days integer not null default 1 check (min_days >= 0),
  max_days integer not null default 3,
  requires_address boolean not null default true,
  carrier text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_days >= min_days)
);
create trigger shipping_methods_updated_at before update on public.shipping_methods for each row execute function public.set_updated_at();

-- Single-row, database-backed store configuration. Contains no secrets.
create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null default 'SPORTX',
  tagline text not null default 'MOVE. TRAIN. PERFORM.',
  support_email text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  country text not null default 'Djibouti',
  currency text not null default 'DJF' check (currency in ('DJF', 'USD', 'EUR')),
  timezone text not null default 'Africa/Djibouti',
  logo_url text,
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  tax_inclusive boolean not null default false,
  free_shipping_threshold bigint check (free_shipping_threshold is null or free_shipping_threshold >= 0),
  order_prefix text not null default 'SPX' check (order_prefix ~ '^[A-Z]{2,6}$'),
  low_stock_default integer not null default 5 check (low_stock_default >= 0),
  pending_payment_ttl_minutes integer not null default 60 check (pending_payment_ttl_minutes between 5 and 10080),
  max_quantity_per_line integer not null default 10 check (max_quantity_per_line between 1 and 100),
  notification_settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger store_settings_updated_at before update on public.store_settings for each row execute function public.set_updated_at();

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description text not null default '',
  type public.discount_type not null,
  value bigint not null check (value > 0),
  minimum_order_amount bigint not null default 0 check (minimum_order_amount >= 0),
  maximum_discount bigint check (maximum_discount is null or maximum_discount > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_user_limit integer check (per_user_limit is null or per_user_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  is_active boolean not null default true,
  category_ids uuid[] not null default '{}',
  product_ids uuid[] not null default '{}',
  customer_groups text[] not null default '{}',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (type <> 'PERCENTAGE' or value <= 100),
  check (ends_at is null or ends_at > starts_at)
);
create unique index coupons_code_key on public.coupons (code) where deleted_at is null;
create trigger coupons_updated_at before update on public.coupons for each row execute function public.set_updated_at();

create table public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  order_id uuid not null,
  discount_amount bigint not null check (discount_amount >= 0),
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);
create index coupon_usages_user_idx on public.coupon_usages (coupon_id, user_id);

-- Automatic (code-less) catalogue discounts.
create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.discount_type not null,
  value bigint not null check (value > 0),
  applies_to public.discount_scope not null default 'ALL',
  target_ids uuid[] not null default '{}',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'PERCENTAGE' or value <= 100),
  check (ends_at is null or ends_at > starts_at),
  check (applies_to = 'ALL' or cardinality(target_ids) > 0)
);
create index discounts_window_idx on public.discounts (is_active, starts_at, ends_at);
create trigger discounts_updated_at before update on public.discounts for each row execute function public.set_updated_at();

create table public.flash_sales (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discount_percent integer not null check (discount_percent between 1 and 90),
  product_ids uuid[] not null check (cardinality(product_ids) > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index flash_sales_window_idx on public.flash_sales (is_active, starts_at, ends_at);
create trigger flash_sales_updated_at before update on public.flash_sales for each row execute function public.set_updated_at();

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('seasonal', 'new_arrivals', 'football', 'basketball', 'training', 'clearance', 'limited_release')),
  description text not null default '',
  banner_url text,
  banner_path text,
  product_ids uuid[] not null default '{}',
  category_ids uuid[] not null default '{}',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.campaign_status not null default 'DRAFT',
  impressions integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create trigger campaigns_updated_at before update on public.campaigns for each row execute function public.set_updated_at();
