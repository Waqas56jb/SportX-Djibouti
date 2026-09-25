-- SPORTX — Supabase Storage bucket for catalogue media.
-- Public read (images are shown on the storefront); uploads only through the API with the service role.
-- Guarded so the migration is a no-op on plain PostgreSQL (local development / tests).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('sportx-media', 'sportx-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
