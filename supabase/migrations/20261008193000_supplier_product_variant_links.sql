-- Un precio de insumo puede aplicarse a una o más variantes publicadas.
-- Esto permite asignar, por ejemplo, "Pequeña" solo a talla S.
create table if not exists public.supplier_product_variants (
  supplier_product_id bigint not null references public.supplier_products(id) on delete cascade,
  product_variant_id bigint not null references public.product_variants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (supplier_product_id, product_variant_id)
);

create index if not exists supplier_product_variants_variant_idx
  on public.supplier_product_variants (product_variant_id);

alter table public.supplier_product_variants enable row level security;
grant select, insert, update, delete on public.supplier_product_variants to authenticated;
drop policy if exists "admin_supplier_product_variants_manage" on public.supplier_product_variants;
create policy "admin_supplier_product_variants_manage"
  on public.supplier_product_variants for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Relación inicial para las tres tallas que ya existen en Poleras Adultos Básica.
-- No se deduce ningún otro vínculo: se administra explícitamente desde Precios.
insert into public.supplier_product_variants (supplier_product_id, product_variant_id)
select supplier_product.id, variant.id
from public.supplier_products supplier_product
join public.supplier_categories category on category.id = supplier_product.category_id
join public.product_variants variant on variant.active
join public.product_models model on model.id = variant.product_model_id and model.code = 'basic'
where category.name = 'Poleras Adultos Basica'
  and (
    (supplier_product.name = 'Pequeña' and variant.size = 'S')
    or (supplier_product.name = 'Mediana' and variant.size = 'M')
    or (supplier_product.name = 'Grande' and variant.size = 'L')
  )
on conflict do nothing;

comment on table public.supplier_product_variants is
  'Variantes de catálogo a las que se aplica el precio confirmado de un insumo principal.';
