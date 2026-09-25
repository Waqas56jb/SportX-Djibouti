-- Inventory managers edit product variants, so the product form needs to read categories and brands.
insert into public.role_permissions (role_id, permission_key)
select r.id, 'categories:view' from public.roles r where r.slug = 'INVENTORY_MANAGER'
on conflict do nothing;
