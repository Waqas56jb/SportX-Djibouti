-- SPORTX — reference data required by every environment (not demo data).

insert into public.permissions (key, module, action, description)
select m.module || ':' || a.action, m.module, a.action, initcap(a.action) || ' ' || m.label
from (values
  ('dashboard', 'dashboard', array['view', 'export']),
  ('products', 'products', array['view', 'create', 'edit', 'delete', 'approve', 'export']),
  ('categories', 'categories & brands', array['view', 'create', 'edit', 'delete']),
  ('inventory', 'inventory', array['view', 'create', 'edit', 'approve', 'export']),
  ('orders', 'orders', array['view', 'create', 'edit', 'delete', 'approve', 'export']),
  ('customers', 'customers', array['view', 'create', 'edit', 'delete', 'export']),
  ('reviews', 'reviews', array['view', 'edit', 'delete', 'approve']),
  ('discounts', 'marketing', array['view', 'create', 'edit', 'delete', 'approve']),
  ('reports', 'reports', array['view', 'export']),
  ('support', 'support', array['view', 'create', 'edit', 'delete']),
  ('settings', 'settings', array['view', 'create', 'edit', 'delete'])
) as m(module, label, actions)
cross join lateral unnest(m.actions) as a(action)
on conflict (key) do nothing;

insert into public.roles (slug, name, description, is_system, is_staff) values
  ('CUSTOMER', 'Customer', 'Storefront customer. No back-office access.', true, false),
  ('SUPER_ADMIN', 'Super Admin', 'Full access to every module, including admin users, roles and payment settings.', true, true),
  ('ADMIN', 'Admin', 'Runs day-to-day operations across all modules. Cannot create or delete admin users and roles.', true, true),
  ('PRODUCT_MANAGER', 'Product Manager', 'Catalogue: products, variants, categories, brands and review moderation.', true, true),
  ('ORDER_MANAGER', 'Order Manager', 'Orders, fulfilment, shipping and refunds.', true, true),
  ('INVENTORY_MANAGER', 'Inventory Manager', 'Stock levels, adjustments and product variants.', true, true),
  ('SUPPORT_MANAGER', 'Support Manager', 'Support tickets and customer accounts.', true, true)
on conflict (slug) do nothing;

-- Role → permission grants.
with grants(role_slug, pattern) as (values
  ('SUPER_ADMIN', '%'),
  ('ADMIN', 'dashboard:%'), ('ADMIN', 'products:%'), ('ADMIN', 'categories:%'), ('ADMIN', 'inventory:%'),
  ('ADMIN', 'orders:%'), ('ADMIN', 'customers:%'), ('ADMIN', 'reviews:%'), ('ADMIN', 'discounts:%'),
  ('ADMIN', 'reports:%'), ('ADMIN', 'support:%'), ('ADMIN', 'settings:view'), ('ADMIN', 'settings:edit'),
  ('PRODUCT_MANAGER', 'dashboard:view'), ('PRODUCT_MANAGER', 'products:%'), ('PRODUCT_MANAGER', 'categories:%'),
  ('PRODUCT_MANAGER', 'inventory:view'), ('PRODUCT_MANAGER', 'reviews:view'), ('PRODUCT_MANAGER', 'reviews:edit'),
  ('PRODUCT_MANAGER', 'reviews:approve'), ('PRODUCT_MANAGER', 'reports:view'),
  ('ORDER_MANAGER', 'dashboard:view'), ('ORDER_MANAGER', 'orders:%'), ('ORDER_MANAGER', 'customers:view'),
  ('ORDER_MANAGER', 'products:view'), ('ORDER_MANAGER', 'inventory:view'), ('ORDER_MANAGER', 'support:view'),
  ('ORDER_MANAGER', 'support:edit'), ('ORDER_MANAGER', 'reports:view'),
  ('INVENTORY_MANAGER', 'dashboard:view'), ('INVENTORY_MANAGER', 'inventory:%'), ('INVENTORY_MANAGER', 'products:view'),
  ('INVENTORY_MANAGER', 'products:edit'), ('INVENTORY_MANAGER', 'reports:view'),
  ('SUPPORT_MANAGER', 'dashboard:view'), ('SUPPORT_MANAGER', 'support:%'), ('SUPPORT_MANAGER', 'customers:view'),
  ('SUPPORT_MANAGER', 'customers:edit'), ('SUPPORT_MANAGER', 'orders:view'), ('SUPPORT_MANAGER', 'reviews:view'),
  ('SUPPORT_MANAGER', 'reviews:approve')
)
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from grants g
join public.roles r on r.slug = g.role_slug
join public.permissions p on p.key like g.pattern
on conflict do nothing;

-- Store configuration: only the business details supplied by SPORTX.
insert into public.store_settings (id, store_name, tagline, phone, address_line_1, address_line_2, city, country, currency,
  timezone, tax_rate, free_shipping_threshold, order_prefix)
values (1, 'SPORTX', 'MOVE. TRAIN. PERFORM.', '+253 21 25 26 19', 'PLACE MENELIK', 'RUE DE RAS MAKONNEN', 'DJIBOUTI',
  'Djibouti', 'DJF', 'Africa/Djibouti', 0, 25000, 'SPX')
on conflict (id) do nothing;

-- Default shipping configuration (editable in the admin).
with zone as (
  insert into public.shipping_zones (name, regions, sort_order)
  values ('Djibouti', array['Djibouti City', 'Ali Sabieh', 'Arta', 'Dikhil', 'Obock', 'Tadjourah'], 0)
  returning id
)
insert into public.shipping_methods (zone_id, code, name, description, price, min_days, max_days, requires_address, carrier, sort_order)
select zone.id, m.code, m.name, m.description, m.price, m.min_days, m.max_days, m.requires_address, m.carrier, m.sort_order
from zone, (values
  ('standard', 'Standard Delivery', 'Delivered by SPORTX courier across Djibouti.', 1000::bigint, 2, 4, true, 'SPORTX Courier', 0),
  ('express', 'Express Delivery', 'Next business day in Djibouti City.', 2500::bigint, 1, 1, true, 'SPORTX Courier', 1),
  ('pickup', 'Store Pickup', 'Collect from SPORTX, Place Menelik, Rue de Ras Makonnen.', 0::bigint, 1, 2, false, null, 2)
) as m(code, name, description, price, min_days, max_days, requires_address, carrier, sort_order);
