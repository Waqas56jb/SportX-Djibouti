-- SPORTX — identity, roles and permissions.

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Application profile. Credentials live in Supabase Auth (auth.users) in production;
-- the local provider (development/tests) uses auth_credentials below. Never plain text.
create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  avatar_url text,
  status public.user_status not null default 'ACTIVE',
  marketing_opt_in boolean not null default false,
  notes text,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index users_email_active_key on public.users (lower(email)) where deleted_at is null;
create index users_created_at_idx on public.users (created_at desc);
create trigger users_updated_at before update on public.users for each row execute function public.set_updated_at();

-- Local auth provider only (AUTH_PROVIDER=local). scrypt hash, never plain text.
create table public.auth_credentials (
  user_id uuid primary key references public.users (id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

-- Refresh sessions for both auth providers (the API issues its own access tokens). Only a SHA-256 hash of the refresh token is stored.
create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  refresh_token_hash text not null unique,
  scope text not null default 'customer' check (scope in ('customer', 'admin')),
  user_agent text,
  ip_address text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index auth_sessions_user_idx on public.auth_sessions (user_id);

-- One-time tokens for the local provider (email verification, password reset). Hash only.
create table public.auth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  purpose public.auth_token_purpose not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null,
  description text not null default '',
  is_system boolean not null default false,
  is_staff boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger roles_updated_at before update on public.roles for each row execute function public.set_updated_at();

-- Permission keys are "<module>:<action>", e.g. "orders:edit".
create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+:[a-z_]+$'),
  module text not null,
  action text not null,
  description text not null default ''
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.user_roles (
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index user_roles_role_idx on public.user_roles (role_id);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  label text not null default 'Home',
  first_name text not null,
  last_name text not null,
  phone text not null,
  address_line_1 text not null,
  address_line_2 text,
  district text,
  city text not null,
  country text not null default 'Djibouti',
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;
create trigger addresses_updated_at before update on public.addresses for each row execute function public.set_updated_at();

-- Monotonic counters for human-readable numbers (order numbers, ticket numbers).
create table public.counters (
  name text primary key,
  value bigint not null default 0
);

create or replace function public.next_counter(counter_name text) returns bigint
language plpgsql as $$
declare v bigint;
begin
  insert into public.counters (name, value) values (counter_name, 1)
  on conflict (name) do update set value = public.counters.value + 1
  returning value into v;
  return v;
end $$;
