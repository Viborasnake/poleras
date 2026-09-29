-- Catálogo de costos independiente: prendas y DTF son productos separados.

create table if not exists public.supplier_products (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  kind text not null default 'garment' check (kind in ('garment', 'dtf', 'other')),
  model_code text,
  dtf_product_id bigint,
  unit_cost_clp integer not null default 0 check (unit_cost_clp >= 0),
  other_cost_clp integer not null default 0 check (other_cost_clp >= 0),
  sheet_width_cm numeric(8,2),
  sheet_height_cm numeric(8,2),
  print_width_cm numeric(8,2) not null default 28 check (print_width_cm > 0),
  print_height_cm numeric(8,2) not null default 40 check (print_height_cm > 0),
  margin_percent numeric(7,2) not null default 150 check (margin_percent >= 0),
  vat_percent numeric(5,2) not null default 19 check (vat_percent >= 0),
  active boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_products_model_code_fk foreign key (model_code) references public.product_models(code) on update cascade on delete set null,
  constraint supplier_products_sheet_dimensions check (kind <> 'dtf' or (sheet_width_cm > 0 and sheet_height_cm > 0))
);

alter table public.supplier_products add column if not exists dtf_product_id bigint references public.supplier_products(id) on delete set null;

alter table public.supplier_products enable row level security;
grant select, insert, update, delete on public.supplier_products to authenticated;
drop policy if exists "admin_supplier_products_manage" on public.supplier_products;
create policy "admin_supplier_products_manage" on public.supplier_products for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.supplier_products (name, slug, kind, model_code, unit_cost_clp, print_width_cm, print_height_cm)
select model.name, 'prenda-' || model.code, 'garment', model.code, 0, 28, 40
from public.product_models model
where model.code in ('basic', 'over', 'kid', 'body')
on conflict (slug) do nothing;
