-- Separa los grupos operativos de las categorías concretas de insumos.

insert into public.supplier_categories (name, slug, scope, sort_order)
values
  ('Poleras', 'poleras', 'principal', 10),
  ('Acrílicos y bases', 'acrilicos-bases', 'principal', 20),
  ('DTF', 'dtf', 'secondary', 10),
  ('Tabloide', 'tabloide', 'secondary', 20),
  ('Adhesivo', 'adhesivo', 'secondary', 30),
  ('Otros insumos', 'otros-insumos', 'secondary', 40)
on conflict (slug) do update set active = true, updated_at = now();

update public.supplier_products product
set category_id = category.id
from public.supplier_categories category
where category.slug = case
  when product.kind in ('garment') then 'poleras'
  when product.kind in ('acrylic', 'magnet') then 'acrilicos-bases'
  when product.kind = 'dtf' then 'dtf'
  when product.kind = 'tabloid' then 'tabloide'
  when product.kind = 'adhesive' then 'adhesivo'
  else 'otros-insumos'
end;

update public.supplier_categories
set active = false, updated_at = now()
where slug in (
  'insumo-principal', 'insumo-secundario',
  'polera-basica', 'polera-kid', 'polera-oversize', 'body-bebe'
);
