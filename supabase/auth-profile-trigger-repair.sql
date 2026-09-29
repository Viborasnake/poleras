-- Repair for Auth signups failing with:
-- "Database error saving new user".
-- Run once in the Supabase SQL Editor for the configured project.

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

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists region text,
  add column if not exists commune text,
  add column if not exists address text,
  add column if not exists address_extra text,
  add column if not exists delivery_notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_data jsonb := coalesce(new.raw_user_meta_data -> 'customer_profile', '{}'::jsonb);
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
  )
  on conflict (id) do update set
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
