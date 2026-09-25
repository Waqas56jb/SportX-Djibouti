-- Distinguish rotated refresh tokens (reuse = theft signal) from tokens revoked by logout or a
-- password change (reuse = normal, just expired). Align cart line limits with store settings.
alter table public.auth_sessions add column if not exists rotated_at timestamptz;

alter table public.cart_items drop constraint if exists cart_items_quantity_check;
alter table public.cart_items add constraint cart_items_quantity_check check (quantity between 1 and 100);

-- A soft-deleted variant must not block reusing its SKU.
alter table public.product_variants drop constraint if exists product_variants_sku_key;
create unique index if not exists product_variants_sku_active_key on public.product_variants (sku) where deleted_at is null;
create index if not exists product_variants_live_idx on public.product_variants (product_id) where deleted_at is null;

-- Reports and dashboards filter by placed_at.
create index if not exists orders_placed_idx on public.orders (placed_at desc);
create index if not exists orders_payment_placed_idx on public.orders (payment_status, placed_at);
-- Storage key of the uploaded store logo (so a replaced logo can be deleted).
alter table public.store_settings add column if not exists logo_path text;
