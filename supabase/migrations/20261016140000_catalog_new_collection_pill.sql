alter table public.catalog_collections
  add column if not exists is_new_collection boolean not null default false;

comment on column public.catalog_collections.is_new_collection is
  'Muestra la pill editorial Nueva colección en las tarjetas públicas.';
