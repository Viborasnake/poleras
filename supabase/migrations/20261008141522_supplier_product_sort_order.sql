alter table public.supplier_products
  add column if not exists sort_order integer not null default 0;

with ordered_products as (
  select id,
    row_number() over (partition by category_id order by name, id) * 10 as next_sort_order
  from public.supplier_products
)
update public.supplier_products product
set sort_order = ordered_products.next_sort_order,
    updated_at = now()
from ordered_products
where product.id = ordered_products.id
  and product.sort_order = 0;

create index if not exists supplier_products_category_sort_idx
  on public.supplier_products (category_id, sort_order, id);

comment on column public.supplier_products.sort_order is
  'Orden manual de los insumos dentro de cada categoría administrativa.';
