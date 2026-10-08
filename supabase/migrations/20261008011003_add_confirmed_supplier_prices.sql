-- Decisión comercial del precio: el cálculo queda como sugerencia y el admin
-- confirma el valor que finalmente se publica en las variantes.
alter table public.supplier_products
  add column if not exists confirmed_price_clp integer,
  add column if not exists price_confirmed_at timestamptz,
  add column if not exists price_confirmed_by uuid references auth.users(id) on delete set null;

alter table public.supplier_products
  drop constraint if exists supplier_products_confirmed_price_check,
  add constraint supplier_products_confirmed_price_check
    check (confirmed_price_clp is null or confirmed_price_clp >= 0);

create index if not exists supplier_products_confirmed_price_idx
  on public.supplier_products (confirmed_price_clp);

comment on column public.supplier_products.confirmed_price_clp is
  'Precio comercial final confirmado por administración, normalmente con IVA incluido.';
comment on column public.supplier_products.price_confirmed_at is
  'Momento en que administración confirmó el precio comercial.';
