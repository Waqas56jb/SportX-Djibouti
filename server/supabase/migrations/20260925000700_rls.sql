-- SPORTX — Row Level Security.
--
-- The Node API connects with a privileged server-side connection (table owner / service role) and
-- performs every business operation itself. RLS is defence in depth: if anyone reaches Supabase
-- directly with the public anon key, they can only read the public catalogue and — when signed in
-- through Supabase Auth — their own records. No client can write orders, payments, inventory,
-- prices, coupons or roles directly.

-- Maps the Supabase Auth user (auth.uid()) to the application user row.
create or replace function public.current_app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select u.id from public.users u where u.auth_user_id = auth.uid() and u.deleted_at is null limit 1
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'users', 'auth_credentials', 'auth_sessions', 'auth_tokens', 'roles', 'permissions', 'role_permissions', 'user_roles',
    'addresses', 'counters', 'categories', 'brands', 'products', 'product_images', 'product_variants', 'inventory',
    'inventory_movements', 'carts', 'cart_items', 'wishlists', 'wishlist_items', 'shipping_zones', 'shipping_methods',
    'store_settings', 'coupons', 'coupon_usages', 'discounts', 'flash_sales', 'campaigns', 'orders', 'order_items',
    'order_status_history', 'order_events', 'payments', 'payment_status_history', 'payment_events', 'refunds', 'shipping',
    'reviews', 'notifications', 'support_tickets', 'support_messages', 'admin_activity_logs', 'newsletter_subscribers',
    'contact_messages'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ─── Public catalogue (read-only) ───────────────────────────────────────────
create policy categories_public_read on public.categories for select to anon, authenticated using (is_active);
create policy brands_public_read on public.brands for select to anon, authenticated using (is_active);
create policy products_public_read on public.products for select to anon, authenticated
  using (status = 'PUBLISHED' and deleted_at is null);
create policy product_images_public_read on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'PUBLISHED' and p.deleted_at is null));
create policy product_variants_public_read on public.product_variants for select to anon, authenticated
  using (is_active and deleted_at is null and exists (select 1 from public.products p where p.id = product_id and p.status = 'PUBLISHED' and p.deleted_at is null));
create policy shipping_methods_public_read on public.shipping_methods for select to anon, authenticated using (is_active);
create policy reviews_public_read on public.reviews for select to anon, authenticated
  using (status = 'APPROVED' and deleted_at is null);

-- ─── Own records (signed-in customers) ──────────────────────────────────────
create policy users_self_read on public.users for select to authenticated using (id = public.current_app_user_id());
create policy addresses_own on public.addresses for select to authenticated using (user_id = public.current_app_user_id());
create policy carts_own on public.carts for select to authenticated using (user_id = public.current_app_user_id());
create policy cart_items_own on public.cart_items for select to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = public.current_app_user_id()));
create policy wishlists_own on public.wishlists for select to authenticated using (user_id = public.current_app_user_id());
create policy wishlist_items_own on public.wishlist_items for select to authenticated
  using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = public.current_app_user_id()));
create policy orders_own on public.orders for select to authenticated
  using (user_id = public.current_app_user_id() and deleted_at is null);
create policy order_items_own on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = public.current_app_user_id()));
create policy order_status_history_own on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = public.current_app_user_id()));
create policy shipping_own on public.shipping for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = public.current_app_user_id()));
create policy reviews_own on public.reviews for select to authenticated using (user_id = public.current_app_user_id());
create policy notifications_own on public.notifications for select to authenticated
  using (audience = 'CUSTOMER' and user_id = public.current_app_user_id());
create policy support_tickets_own on public.support_tickets for select to authenticated using (user_id = public.current_app_user_id());
create policy support_messages_own on public.support_messages for select to authenticated
  using (not is_internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = public.current_app_user_id()));

-- Every other table (payments, inventory, coupons, roles, settings, logs, credentials, sessions …) has RLS
-- enabled with no policy, so anon/authenticated clients get nothing. Only the API can touch them.
