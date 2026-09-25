-- SPORTX — reviews, notifications, support, audit log, newsletter, contact.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  title text not null check (char_length(title) between 2 and 120),
  comment text not null check (char_length(comment) between 10 and 2000),
  fit text check (fit is null or fit in ('small', 'true', 'large')),
  size text,
  status public.review_status not null default 'PENDING',
  verified_purchase boolean not null default false,
  helpful_count integer not null default 0 check (helpful_count >= 0),
  moderated_by uuid references public.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index reviews_one_per_user_product on public.reviews (product_id, user_id) where deleted_at is null;
create index reviews_product_idx on public.reviews (product_id, status);
create index reviews_status_idx on public.reviews (status, created_at desc);
create trigger reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();

-- products.rating / review_count only count APPROVED, non-deleted reviews.
create or replace function public.refresh_product_rating() returns trigger
language plpgsql as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    rating = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.product_id = pid and r.status = 'APPROVED' and r.deleted_at is null), 0),
    review_count = (select count(*) from public.reviews r where r.product_id = pid and r.status = 'APPROVED' and r.deleted_at is null)
  where p.id = pid;
  return null;
end $$;
create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience public.notification_audience not null default 'CUSTOMER',
  -- Customer notifications target one user; staff notifications (audience ADMIN) are shared (user_id null).
  user_id uuid references public.users (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  message text not null,
  link text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (audience = 'ADMIN' or user_id is not null)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_admin_idx on public.notifications (audience, created_at desc) where audience = 'ADMIN';

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  user_id uuid not null references public.users (id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 160),
  category public.ticket_category not null default 'OTHER',
  priority public.ticket_priority not null default 'NORMAL',
  status public.ticket_status not null default 'OPEN',
  order_id uuid references public.orders (id) on delete set null,
  assigned_to uuid references public.users (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets (user_id, updated_at desc);
create index support_tickets_status_idx on public.support_tickets (status, updated_at desc);
create trigger support_tickets_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references public.users (id) on delete set null,
  author_type public.actor_type not null,
  body text not null check (char_length(body) between 1 and 5000),
  -- Internal notes are visible to staff only and never returned to the customer.
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  check (not (is_internal and author_type = 'CUSTOMER'))
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

create table public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'SUCCESS' check (status in ('SUCCESS', 'FAILED')),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index admin_activity_logs_created_idx on public.admin_activity_logs (created_at desc);
create index admin_activity_logs_admin_idx on public.admin_activity_logs (admin_id, created_at desc);
create index admin_activity_logs_entity_idx on public.admin_activity_logs (entity_type, entity_id);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);
create unique index newsletter_subscribers_email_key on public.newsletter_subscribers (lower(email));

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null check (char_length(message) between 5 and 5000),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
