-- Operación de pedidos: canal manual, cierre por despacho/retiro y cupones.
alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists source text not null default 'online';
alter table public.orders add column if not exists coupon_code text;

alter table public.orders drop constraint if exists orders_source_check;
alter table public.orders add constraint orders_source_check check (source in ('online', 'manual'));
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'draft','submitted','quoted','awaiting_deposit','deposit_paid','in_design',
  'proposal_ready','approved','awaiting_balance','paid','in_production',
  'ready','shipped','ready_for_pickup','delivered','cancelled'
));

create table if not exists public.coupons (
  id bigint generated always as identity primary key,
  code text not null unique,
  description text,
  kind text not null check (kind in ('percent', 'fixed')),
  value integer not null check (value > 0),
  min_subtotal_clp integer not null default 0 check (min_subtotal_clp >= 0),
  max_discount_clp integer check (max_discount_clp is null or max_discount_clp >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_format check (code ~ '^[A-Z0-9_-]{3,32}$'),
  constraint coupons_dates_valid check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint coupons_percent_valid check (kind <> 'percent' or value <= 100)
);

create table if not exists public.coupon_redemptions (
  id bigint generated always as identity primary key,
  coupon_id bigint not null references public.coupons(id) on delete restrict,
  order_id bigint not null unique references public.orders(id) on delete cascade,
  amount_clp integer not null check (amount_clp >= 0),
  redeemed_at timestamptz not null default now()
);

create index if not exists orders_source_created_idx on public.orders(source, created_at desc);
create index if not exists coupons_active_code_idx on public.coupons(active, code);
create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id, redeemed_at desc);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

grant select, insert, update, delete on public.orders, public.order_items, public.order_status_history to authenticated;
grant select, insert, update, delete on public.coupons, public.coupon_redemptions to authenticated;
grant usage, select on sequence public.coupons_id_seq, public.coupon_redemptions_id_seq to authenticated;

drop policy if exists "admin_orders_manage" on public.orders;
create policy "admin_orders_manage" on public.orders for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admin_order_items_manage" on public.order_items;
create policy "admin_order_items_manage" on public.order_items for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admin_order_history_manage" on public.order_status_history;
create policy "admin_order_history_manage" on public.order_status_history for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admin_coupons_manage" on public.coupons;
create policy "admin_coupons_manage" on public.coupons for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admin_coupon_redemptions_manage" on public.coupon_redemptions;
create policy "admin_coupon_redemptions_manage" on public.coupon_redemptions for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Conserva la información capturada durante un checkout invitado al crear cuenta.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare profile_data jsonb := coalesce(new.raw_user_meta_data -> 'customer_profile', '{}'::jsonb);
begin
  insert into public.profiles (
    id, full_name, phone, region, commune, address, address_extra, delivery_notes
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(profile_data ->> 'phone', ''),
    nullif(profile_data ->> 'region', ''),
    nullif(profile_data ->> 'commune', ''),
    nullif(profile_data ->> 'address', ''),
    nullif(profile_data ->> 'address_extra', ''),
    nullif(profile_data ->> 'delivery_notes', '')
  ) on conflict (id) do update set
    full_name = excluded.full_name,
    phone = coalesce(excluded.phone, public.profiles.phone),
    region = coalesce(excluded.region, public.profiles.region),
    commune = coalesce(excluded.commune, public.profiles.commune),
    address = coalesce(excluded.address, public.profiles.address),
    address_extra = coalesce(excluded.address_extra, public.profiles.address_extra),
    delivery_notes = coalesce(excluded.delivery_notes, public.profiles.delivery_notes),
    updated_at = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
