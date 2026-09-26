-- Ejecutar una vez en el SQL Editor del proyecto dgndcklmmnnxyqfmnckh.
-- No se aplica automáticamente desde la web ni desde Vercel.
-- Si ya existe un bucket con este ID, revisar su configuración antes de continuar.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-designs',
  'customer-designs',
  false,
  52428800,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- El nombre del objeto siempre empieza con el UUID de la persona autenticada.
-- No hay acceso para anon ni permisos de actualización o borrado.
create policy "droska_designs_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-designs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in ('front', 'back')
);

create policy "droska_designs_read_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'customer-designs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Comprobaciones después de aplicar:
-- select id, public, file_size_limit, allowed_mime_types
-- from storage.buckets where id = 'customer-designs';
-- select policyname, cmd, roles from pg_policies
-- where schemaname = 'storage' and tablename = 'objects'
-- and policyname like 'droska_designs_%';
