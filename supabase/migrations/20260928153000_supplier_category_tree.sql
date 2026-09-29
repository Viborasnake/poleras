-- Jerarquía de dos niveles: grupo principal y categoría secundaria.

alter table public.supplier_categories
  add column if not exists parent_category_id bigint references public.supplier_categories(id) on delete restrict;

update public.supplier_categories
set name = 'Insumos principales', active = true, updated_at = now()
where slug = 'insumo-principal';

update public.supplier_categories
set name = 'Insumos secundarios', active = true, updated_at = now()
where slug = 'insumo-secundario';

insert into public.supplier_categories (name, slug, scope, sort_order)
select item.name, item.slug, item.scope, item.sort_order
from (values
  ('Bodys', 'bodys', 'principal', 15),
  ('Imanes', 'imanes', 'principal', 25),
  ('Afiches', 'afiches', 'secondary', 15)
) as item(name, slug, scope, sort_order)
where not exists (select 1 from public.supplier_categories existing where existing.slug = item.slug);

update public.supplier_categories category
set parent_category_id = parent.id, updated_at = now()
from public.supplier_categories parent
where parent.slug = case when category.scope = 'principal' then 'insumo-principal' else 'insumo-secundario' end
  and category.slug not in ('insumo-principal', 'insumo-secundario');

update public.supplier_products product
set category_id = category.id
from public.supplier_categories category
where category.slug = case
  when product.kind = 'garment' and lower(product.name) like '%body%' then 'bodys'
  when product.kind in ('garment') then 'poleras'
  when product.kind in ('acrylic', 'magnet') then 'imanes'
  when product.kind = 'poster' then 'afiches'
  when product.kind = 'dtf' then 'dtf'
  when product.kind = 'tabloid' then 'tabloide'
  when product.kind = 'adhesive' then 'adhesivo'
  else 'otros-insumos'
end;
