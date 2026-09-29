-- Soportes de impresión futuros, agrupados como insumos operativos.

alter table public.supplier_products drop constraint if exists supplier_products_kind_check;
alter table public.supplier_products add constraint supplier_products_kind_check
  check (kind in ('garment', 'dtf', 'poster', 'magnet', 'tabloid', 'adhesive', 'supply'));
