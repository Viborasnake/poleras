-- Las categorías agrupan colecciones sin cambiar sus URLs ni sus diseños.
create table if not exists public.catalog_categories (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint catalog_categories_slug_format check (slug ~ '^[a-z0-9-]+$')
);

insert into public.catalog_categories (slug,name,sort_order) values
  ('general','Más ideas',0),
  ('videojuegos','Videojuegos',10),
  ('anime','Anime',20),
  ('paisajes','Paisajes',30),
  ('animales','Animales',40)
on conflict (slug) do nothing;

alter table public.catalog_collections
  add column if not exists category_id bigint references public.catalog_categories(id) on delete restrict;
update public.catalog_collections
set category_id = (select id from public.catalog_categories where slug='general')
where category_id is null;
update public.catalog_collections
set category_id = (select id from public.catalog_categories where slug='videojuegos')
where slug in ('juegos','death-stranding','metal-gear','resident-evil')
  and category_id = (select id from public.catalog_categories where slug='general');
update public.catalog_collections
set category_id = (select id from public.catalog_categories where slug='anime')
where slug = 'sailor-moon'
  and category_id = (select id from public.catalog_categories where slug='general');
alter table public.catalog_collections alter column category_id set not null;
create index if not exists catalog_collections_category_id_idx on public.catalog_collections(category_id);

alter table public.catalog_categories enable row level security;
revoke all on public.catalog_categories from anon, authenticated;
grant select on public.catalog_categories to anon, authenticated;
grant insert, update, delete on public.catalog_categories to authenticated;
grant usage, select on sequence public.catalog_categories_id_seq to authenticated;
create policy "catalog_categories_read" on public.catalog_categories
  for select to anon, authenticated using (active);
create policy "admin_categories_manage" on public.catalog_categories
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
