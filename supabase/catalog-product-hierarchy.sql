create table if not exists public.catalog_product_types (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_product_types_slug_format check (slug ~ '^[a-z0-9-]+$')
);

insert into public.catalog_product_types (slug, name, active, sort_order) values
  ('poleras', 'Poleras', true, 10),
  ('imanes', 'Imanes', true, 20),
  ('afiches', 'Afiches', true, 30)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

alter table public.catalog_collections
  add column if not exists product_type_id bigint references public.catalog_product_types(id) on delete restrict;

update public.catalog_collections
set product_type_id = (select id from public.catalog_product_types where slug = 'poleras')
where product_type_id is null;

alter table public.catalog_collections
  alter column product_type_id set not null;

create index if not exists catalog_collections_product_type_id_idx
  on public.catalog_collections(product_type_id);

alter table public.catalog_product_types enable row level security;
grant select on public.catalog_product_types to anon, authenticated;
grant insert, update, delete on public.catalog_product_types to authenticated;
grant usage, select on all sequences in schema public to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='catalog_product_types' and policyname='catalog_product_types_read') then
    create policy "catalog_product_types_read" on public.catalog_product_types for select to anon, authenticated using (active);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='catalog_product_types' and policyname='admin_product_types_manage') then
    create policy "admin_product_types_manage" on public.catalog_product_types for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
end
$$;
