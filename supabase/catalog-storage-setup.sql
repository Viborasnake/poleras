-- Droska · archivos públicos del catálogo.
-- Aplicar una vez en el SQL Editor del proyecto dgndcklmmnnxyqfmnckh.
-- Solo las cuentas incluidas en private.admin_memberships pueden modificar
-- este bucket. La lectura pública ocurre mediante la URL CDN del bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-designs',
  'catalog-designs',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'admin_catalog_files_select'
  ) then
    create policy "admin_catalog_files_select"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'catalog-designs'
        and (select public.is_admin())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'admin_catalog_files_insert'
  ) then
    create policy "admin_catalog_files_insert"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'catalog-designs'
        and (select public.is_admin())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'admin_catalog_files_update'
  ) then
    create policy "admin_catalog_files_update"
      on storage.objects for update to authenticated
      using (
        bucket_id = 'catalog-designs'
        and (select public.is_admin())
      )
      with check (
        bucket_id = 'catalog-designs'
        and (select public.is_admin())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'admin_catalog_files_delete'
  ) then
    create policy "admin_catalog_files_delete"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'catalog-designs'
        and (select public.is_admin())
      );
  end if;
end
$$;

-- Verificación:
-- select id, public, file_size_limit, allowed_mime_types
-- from storage.buckets where id = 'catalog-designs';
-- select policyname, cmd, roles from pg_policies
-- where schemaname = 'storage' and tablename = 'objects'
-- and policyname like 'admin_catalog_files_%';
