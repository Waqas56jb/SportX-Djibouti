-- SPORTX — catalogue: categories, brands, products, images, variants, inventory.
-- Money is stored as integer amounts in the store currency (DJF has no minor unit).

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  image_url text,
  image_path text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index categories_parent_idx on public.categories (parent_id, sort_order);
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  logo_url text,
  logo_path text,
  website text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brands_name_key on public.brands (lower(name));
create trigger brands_updated_at before update on public.brands for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,40}$'),
  short_description text not null default '',
  description text not null default '',
  brand_id uuid not null references public.brands (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  department text not null check (department in ('footwear', 'apparel', 'equipment', 'accessories')),
  sport text not null check (sport in ('football', 'basketball', 'running', 'training', 'lifestyle', 'multi-sport')),
  gender public.product_gender not null default 'UNISEX',
  product_type text not null default 'apparel',
  price bigint not null check (price > 0),
  compare_at_price bigint check (compare_at_price is null or compare_at_price > price),
  cost_price bigint check (cost_price is null or cost_price >= 0),
  tax_rate numeric(5, 2) check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 100)),
  status public.product_status not null default 'DRAFT',
  is_featured boolean not null default false,
  is_new boolean not null default false,
  badge text check (badge is null or badge in ('new', 'bestseller', 'limited', 'exclusive')),
  features text[] not null default '{}',
  specifications jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  size_guide text not null default 'none' check (size_guide in ('footwear', 'apparel', 'gloves', 'ball', 'none')),
  complete_the_look uuid[] not null default '{}',
  rating numeric(3, 2) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  units_sold integer not null default 0 check (units_sold >= 0),
  view_count integer not null default 0 check (view_count >= 0),
  popularity integer not null default 0,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(sku, '') || ' ' || coalesce(sport, '') || ' ' || coalesce(product_type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(short_description, '') || ' ' || coalesce(description, '')), 'C')
  ) stored
);
create index products_category_idx on public.products (category_id);
create index products_brand_idx on public.products (brand_id);
create index products_status_idx on public.products (status) where deleted_at is null;
create index products_created_idx on public.products (created_at desc);
create index products_price_idx on public.products (price);
create index products_search_idx on public.products using gin (search_vector);
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  storage_path text,
  alt text not null default '',
  role public.image_role not null default 'GALLERY',
  color text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, position);
create unique index product_images_one_main on public.product_images (product_id) where role = 'MAIN';

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,60}$'),
  color text not null,
  color_hex text not null default '#141414' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  size text not null,
  price bigint check (price is null or price > 0),
  compare_at_price bigint check (compare_at_price is null or compare_at_price > 0),
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  barcode text,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index product_variants_product_idx on public.product_variants (product_id, position);
create unique index product_variants_combo_key on public.product_variants (product_id, lower(color), lower(size)) where deleted_at is null;
create index product_variants_size_idx on public.product_variants (lower(size));
create index product_variants_color_idx on public.product_variants (lower(color));
create trigger product_variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();

-- One inventory row per variant. available = stock - reserved; never negative.
create table public.inventory (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  last_restocked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (reserved_quantity <= stock_quantity)
);
create trigger inventory_updated_at before update on public.inventory for each row execute function public.set_updated_at();

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  change integer not null,
  previous_stock integer not null check (previous_stock >= 0),
  new_stock integer not null check (new_stock >= 0),
  reason public.inventory_reason not null,
  note text,
  order_id uuid,
  admin_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_created_idx on public.inventory_movements (created_at desc);

-- Keep products.rating / review_count in sync with APPROVED reviews (created later).
