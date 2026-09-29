-- Enlace de referencia al producto publicado por el proveedor.

alter table public.supplier_products
  add column if not exists supplier_url text;
