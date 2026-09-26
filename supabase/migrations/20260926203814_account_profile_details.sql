alter table public.profiles
  add column if not exists region text,
  add column if not exists commune text,
  add column if not exists address text,
  add column if not exists address_extra text,
  add column if not exists delivery_notes text;

comment on column public.profiles.region is 'Región preferida para despachos';
comment on column public.profiles.commune is 'Comuna preferida para despachos';
comment on column public.profiles.address is 'Dirección preferida para despachos';
comment on column public.profiles.address_extra is 'Departamento, casa u oficina';
comment on column public.profiles.delivery_notes is 'Indicaciones opcionales de entrega';
