-- Costos de proveedores y cálculo de precios para el panel de administración.
-- Aplicar después de commerce-setup.sql y admin-setup.sql.

insert into public.product_models (code, name, description)
values ('body', 'Body bebé', 'Prenda para personalización infantil.')
on conflict (code) do nothing;

create table if not exists public.supplier_costs (
  id bigint generated always as identity primary key,
  product_model_code text not null unique references public.product_models(code) on update cascade on delete restrict,
  product_name text not null,
  garment_cost_clp integer not null default 0 check (garment_cost_clp >= 0),
  supplies_cost_clp integer not null default 0 check (supplies_cost_clp >= 0),
  dtf_sheet_cost_clp integer not null default 0 check (dtf_sheet_cost_clp >= 0),
  dtf_sheet_width_cm numeric(8,2) not null default 56 check (dtf_sheet_width_cm > 0),
  dtf_sheet_height_cm numeric(8,2) not null default 100 check (dtf_sheet_height_cm > 0),
  print_width_cm numeric(8,2) not null default 28 check (print_width_cm > 0),
  print_height_cm numeric(8,2) not null default 35 check (print_height_cm > 0),
  margin_percent numeric(7,2) not null default 150 check (margin_percent >= 0),
  vat_percent numeric(5,2) not null default 19 check (vat_percent >= 0),
  calculated_net_clp integer not null default 0 check (calculated_net_clp >= 0),
  calculated_vat_clp integer not null default 0 check (calculated_vat_clp >= 0),
  suggested_price_clp integer not null default 0 check (suggested_price_clp >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_costs enable row level security;
grant select, insert, update, delete on public.supplier_costs to authenticated;
drop policy if exists "admin_supplier_costs_manage" on public.supplier_costs;
create policy "admin_supplier_costs_manage" on public.supplier_costs for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create index if not exists supplier_costs_model_code_idx on public.supplier_costs(product_model_code);
