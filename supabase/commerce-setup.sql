-- Droska commerce backend · ejecutar una vez en el SQL Editor del proyecto.
-- No usa ni expone service_role. Los pedidos y pagos se crean desde una Edge
-- Function de confianza; el navegador solo puede consultar sus propios datos.

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  region text,
  commune text,
  address text,
  address_extra text,
  delivery_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_models (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_models_code_format check (code ~ '^[a-z0-9-]+$')
);

create table if not exists public.product_variants (
  id bigint generated always as identity primary key,
  product_model_id bigint not null references public.product_models(id) on delete restrict,
  sku text not null unique,
  size text not null,
  color_name text not null,
  color_hex text not null,
  price_clp integer not null check (price_clp >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_color_hex check (color_hex ~ '^#[0-9a-fA-F]{6}$')
);

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
on conflict (slug) do nothing;

create table if not exists public.catalog_collections (
  id bigint generated always as identity primary key,
  product_type_id bigint not null references public.catalog_product_types(id) on delete restrict,
  slug text not null unique,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint catalog_collections_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create table if not exists public.catalog_designs (
  id bigint generated always as identity primary key,
  collection_id bigint not null references public.catalog_collections(id) on delete restrict,
  slug text not null unique,
  name text not null,
  caption text,
  artwork_path text not null,
  mockup_path text,
  mockup_hover_path text,
  sample_color text not null default '#ffffff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_designs_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint catalog_designs_sample_color_format check (sample_color ~ '^#[0-9a-fA-F]{6}$')
);

create table if not exists public.carts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'converted', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists carts_one_active_per_user_idx
  on public.carts (user_id) where status = 'active';

create table if not exists public.cart_items (
  id bigint generated always as identity primary key,
  cart_id bigint not null references public.carts(id) on delete cascade,
  product_variant_id bigint not null references public.product_variants(id) on delete restrict,
  catalog_design_id bigint references public.catalog_designs(id) on delete restrict,
  front_design_path text,
  back_design_path text,
  print_sides text not null check (print_sides in ('front', 'back', 'both')),
  quantity integer not null default 1 check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_design_source check (
    catalog_design_id is not null or front_design_path is not null or back_design_path is not null
  )
);

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'quoted', 'awaiting_deposit', 'deposit_paid',
    'in_design', 'proposal_ready', 'approved', 'awaiting_balance',
    'paid', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'
  )),
  currency text not null default 'CLP' check (currency = 'CLP'),
  subtotal_clp integer not null default 0 check (subtotal_clp >= 0),
  shipping_clp integer not null default 0 check (shipping_clp >= 0),
  discount_clp integer not null default 0 check (discount_clp >= 0),
  total_clp integer not null default 0 check (total_clp >= 0),
  deposit_clp integer not null default 0 check (deposit_clp >= 0),
  price_snapshot jsonb not null default '{}'::jsonb,
  shipping_address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  constraint orders_total_matches_components check (total_clp = subtotal_clp + shipping_clp - discount_clp),
  constraint orders_deposit_not_greater_than_total check (deposit_clp <= total_clp)
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_variant_id bigint references public.product_variants(id) on delete set null,
  catalog_design_id bigint references public.catalog_designs(id) on delete set null,
  name_snapshot text not null,
  sku_snapshot text,
  print_sides text not null check (print_sides in ('front', 'back', 'both')),
  quantity integer not null check (quantity between 1 and 20),
  unit_price_clp integer not null check (unit_price_clp >= 0),
  line_total_clp integer not null check (line_total_clp >= 0),
  front_design_path text,
  back_design_path text,
  created_at timestamptz not null default now(),
  constraint order_items_total_matches_quantity check (line_total_clp = unit_price_clp * quantity)
);

create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_reference text unique,
  kind text not null check (kind in ('deposit', 'balance', 'full', 'refund')),
  status text not null check (status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  amount_clp integer not null check (amount_clp >= 0),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- Every foreign key and common RLS filter is indexed explicitly.
create index if not exists product_variants_model_id_idx on public.product_variants(product_model_id);
create index if not exists catalog_collections_product_type_id_idx on public.catalog_collections(product_type_id);
create index if not exists catalog_designs_collection_id_idx on public.catalog_designs(collection_id);
create index if not exists carts_user_id_idx on public.carts(user_id);
create index if not exists cart_items_cart_id_idx on public.cart_items(cart_id);
create index if not exists cart_items_variant_id_idx on public.cart_items(product_variant_id);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_status_history_order_id_idx on public.order_status_history(order_id, created_at desc);
create index if not exists payments_order_id_idx on public.payments(order_id);

-- Keeps profile creation automatic without trusting editable user metadata for authorization.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS: catálogo público; cada cliente ve y gestiona solo lo suyo.
alter table public.profiles enable row level security;
alter table public.product_models enable row level security;
alter table public.product_variants enable row level security;
alter table public.catalog_product_types enable row level security;
alter table public.catalog_collections enable row level security;
alter table public.catalog_designs enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.product_models, public.product_variants, public.catalog_product_types, public.catalog_collections, public.catalog_designs to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.carts, public.cart_items to authenticated;
grant select on public.orders, public.order_items, public.order_status_history, public.payments to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "catalog_models_read" on public.product_models for select to anon, authenticated using (active);
create policy "catalog_variants_read" on public.product_variants for select to anon, authenticated using (active);
create policy "catalog_product_types_read" on public.catalog_product_types for select to anon, authenticated using (active);
create policy "catalog_collections_read" on public.catalog_collections for select to anon, authenticated using (active);
create policy "catalog_designs_read" on public.catalog_designs for select to anon, authenticated using (active);
create policy "carts_select_own" on public.carts for select to authenticated using (user_id = (select auth.uid()));
create policy "carts_insert_own" on public.carts for insert to authenticated with check (user_id = (select auth.uid()));
create policy "carts_update_own" on public.carts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cart_items_select_own" on public.cart_items for select to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
create policy "cart_items_insert_own" on public.cart_items for insert to authenticated
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
create policy "cart_items_update_own" on public.cart_items for update to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
create policy "cart_items_delete_own" on public.cart_items for delete to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
create policy "orders_select_own" on public.orders for select to authenticated using (user_id = (select auth.uid()));
create policy "order_items_select_own" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy "order_history_select_own" on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy "payments_select_own" on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));

-- Cada cambio de estado deja un registro en la misma transacción.
create or replace function private.track_order_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, note)
    values (new.id, new.status, 'Estado actualizado desde el panel de administración.');
  end if;
  return new;
end;
$$;

revoke all on function private.track_order_status_change() from public, anon, authenticated;
drop trigger if exists track_order_status_change on public.orders;
create trigger track_order_status_change
  after update of status on public.orders
  for each row execute function private.track_order_status_change();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

-- Initial product prices. Changes are made here/server-side, never in the browser.
insert into public.product_models (code, name, description) values
  ('basic', 'Básica', 'Tu favorita para todos los días.'),
  ('over', 'Over', 'Calce amplio, estilo sin esfuerzo.'),
  ('kid', 'Kid', 'Grandes ideas en tallas pequeñas.')
on conflict (code) do nothing;

insert into public.product_variants (product_model_id, sku, size, color_name, color_hex, price_clp)
select pm.id, s.sku, s.size, 'Blanco', '#FFFFFF', s.price_clp
from public.product_models pm
join (values
  ('basic', 'XS', 'DR-BSC-XS-WHT', 14990), ('basic', 'S', 'DR-BSC-S-WHT', 14990), ('basic', 'M', 'DR-BSC-M-WHT', 14990), ('basic', 'L', 'DR-BSC-L-WHT', 14990), ('basic', 'XL', 'DR-BSC-XL-WHT', 14990), ('basic', 'XXL', 'DR-BSC-XXL-WHT', 14990),
  ('over', 'XS', 'DR-OVR-XS-WHT', 21990), ('over', 'S', 'DR-OVR-S-WHT', 21990), ('over', 'M', 'DR-OVR-M-WHT', 21990), ('over', 'L', 'DR-OVR-L-WHT', 21990), ('over', 'XL', 'DR-OVR-XL-WHT', 21990), ('over', 'XXL', 'DR-OVR-XXL-WHT', 21990),
  ('kid', 'XS', 'DR-KID-XS-WHT', 8990), ('kid', 'S', 'DR-KID-S-WHT', 8990), ('kid', 'M', 'DR-KID-M-WHT', 8990), ('kid', 'L', 'DR-KID-L-WHT', 8990), ('kid', 'XL', 'DR-KID-XL-WHT', 8990), ('kid', 'XXL', 'DR-KID-XXL-WHT', 8990)
) as s(model_code, size, sku, price_clp) on s.model_code = pm.code
on conflict (sku) do nothing;

-- Verification query after execution:
-- select p.code, v.size, v.price_clp from public.product_models p
-- join public.product_variants v on v.product_model_id = p.id order by p.code, v.size;
