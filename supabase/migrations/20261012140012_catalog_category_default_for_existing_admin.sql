-- Permite que una versión anterior del panel siga creando colecciones
-- durante el despliegue gradual del frontend con categorías.
do $$
declare general_id bigint;
begin
  select id into general_id from public.catalog_categories where slug='general';
  if general_id is null then raise exception 'Falta la categoría general'; end if;
  execute format('alter table public.catalog_collections alter column category_id set default %s',general_id);
end $$;
