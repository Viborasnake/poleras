-- El tamaño de compra del pliego y el límite de una impresión son datos distintos.
-- Los registros DTF existentes quedan sin definir para que el taller ingrese su límite real.
alter table public.supplier_products
  add column if not exists max_print_width_cm numeric(8,2),
  add column if not exists max_print_height_cm numeric(8,2);

alter table public.supplier_products
  drop constraint if exists supplier_products_max_print_dimensions_check,
  add constraint supplier_products_max_print_dimensions_check
    check (
      kind <> 'dtf'
      or (
        max_print_width_cm is null
        and max_print_height_cm is null
      )
      or (
        coalesce(max_print_width_cm, 0) > 0
        and coalesce(max_print_height_cm, 0) > 0
      )
    );

comment on column public.supplier_products.max_print_width_cm is
  'Ancho máximo de una impresión para el insumo DTF; no corresponde al ancho del pliego comprado.';
comment on column public.supplier_products.max_print_height_cm is
  'Alto máximo de una impresión para el insumo DTF; no corresponde al alto del pliego comprado.';
