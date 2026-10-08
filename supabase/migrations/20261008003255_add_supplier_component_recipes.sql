-- Cada insumo secundario declara cómo se compra. Esto evita tratar cajas,
-- stickers y DTF como si compartieran los mismos campos.
alter table public.supplier_products
  add column if not exists costing_method text not null default 'unit',
  add column if not exists purchase_quantity numeric(12,3) not null default 1,
  add column if not exists purchase_unit_label text not null default 'unidad';

alter table public.supplier_products
  drop constraint if exists supplier_products_costing_method_check,
  drop constraint if exists supplier_products_purchase_quantity_check,
  drop constraint if exists supplier_products_purchase_unit_label_check,
  add constraint supplier_products_costing_method_check
    check (costing_method in ('unit', 'pack', 'sheet')),
  add constraint supplier_products_purchase_quantity_check
    check (purchase_quantity > 0),
  add constraint supplier_products_purchase_unit_label_check
    check (char_length(trim(purchase_unit_label)) between 1 and 40);

update public.supplier_products
set costing_method = 'sheet',
    purchase_quantity = 1,
    purchase_unit_label = 'pliego'
where kind = 'dtf';

-- Una receta permite que un principal reciba varios secundarios. Para DTF,
-- la regla usa el rendimiento del pliego; para el resto, cobra unidades.
create table if not exists public.supplier_product_components (
  id bigint generated always as identity primary key,
  principal_product_id bigint not null references public.supplier_products(id) on delete cascade,
  component_product_id bigint not null references public.supplier_products(id) on delete restrict,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  costing_rule text not null default 'per_unit' check (costing_rule in ('per_unit', 'dtf_yield')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_product_components_unique unique (principal_product_id, component_product_id),
  constraint supplier_product_components_not_self check (principal_product_id <> component_product_id)
);

create index if not exists supplier_product_components_principal_idx
  on public.supplier_product_components (principal_product_id, sort_order, id);

alter table public.supplier_product_components enable row level security;
grant select, insert, update, delete on public.supplier_product_components to authenticated;
drop policy if exists "admin_supplier_product_components_manage" on public.supplier_product_components;
create policy "admin_supplier_product_components_manage"
  on public.supplier_product_components for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Conserva la relación DTF anterior como el primer componente de la receta.
insert into public.supplier_product_components (
  principal_product_id,
  component_product_id,
  quantity,
  costing_rule,
  sort_order
)
select
  principal.id,
  component.id,
  1,
  case when component.kind = 'dtf' then 'dtf_yield' else 'per_unit' end,
  10
from public.supplier_products principal
join public.supplier_products component on component.id = principal.secondary_product_id
where principal.kind in ('garment', 'acrylic', 'magnet')
on conflict (principal_product_id, component_product_id) do nothing;

comment on table public.supplier_product_components is
  'Receta de costo: secundarios que se consumen para producir una unidad del insumo principal.';
comment on column public.supplier_products.costing_method is
  'unit = una unidad por compra; pack = compra contiene varias unidades; sheet = pliego DTF con rendimiento por área.';
