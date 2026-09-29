-- Categorías administrables para organizar los insumos.

create table if not exists public.supplier_categories (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  scope text not null check (scope in ('principal', 'secondary')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_products
  add column if not exists category_id bigint references public.supplier_categories(id) on delete restrict;

alter table public.supplier_categories enable row level security;
grant select, insert, update, delete on public.supplier_categories to authenticated;
drop policy if exists "admin_supplier_categories_manage" on public.supplier_categories;
create policy "admin_supplier_categories_manage" on public.supplier_categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.supplier_categories (name, slug, scope, sort_order)
values ('Insumo principal', 'insumo-principal', 'principal', 10),
       ('Insumo secundario', 'insumo-secundario', 'secondary', 20)
on conflict (slug) do nothing;

update public.supplier_products product
set category_id = category.id
from public.supplier_categories category
where product.category_id is null
  and category.slug = case
    when product.kind in ('garment', 'acrylic', 'magnet') then 'insumo-principal'
    else 'insumo-secundario'
  end;
