alter table public.supplier_products
  drop constraint if exists supplier_products_slug_key;

alter table public.supplier_products
  alter column category_id set not null;

alter table public.supplier_products
  add constraint supplier_products_category_slug_key unique (category_id, slug);

comment on constraint supplier_products_category_slug_key on public.supplier_products is
  'Cada categoría puede tener sus propios nombres de insumo; el nombre no se repite dentro de ella.';
