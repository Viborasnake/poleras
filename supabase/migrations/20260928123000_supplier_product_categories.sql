-- Categorías operativas para agrupar productos de proveedor y dejar espacio
-- para afiches, magnetos y futuros soportes.

alter table public.supplier_products drop constraint if exists supplier_products_kind_check;
alter table public.supplier_products add constraint supplier_products_kind_check
  check (kind in ('garment', 'dtf', 'poster', 'magnet', 'supply'));

insert into public.supplier_products (
  name, slug, kind, unit_cost_clp, sheet_width_cm, sheet_height_cm,
  print_width_cm, print_height_cm, active
)
values ('DTF estándar', 'dtf-estandar', 'dtf', 0, 56, 100, 28, 40, true)
on conflict (slug) do nothing;
