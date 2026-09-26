-- Droska admin access · apply once after commerce-setup.sql.
-- The role list is private. A browser can only ask whether *its own* session
-- is an admin; it can never assign itself the role.

create table if not exists private.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on table private.admin_memberships from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.admin_memberships
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Membership is granted to the stated email only if it already has an Auth user.
insert into private.admin_memberships (user_id)
select id from auth.users where email = 'viborasnake@gmail.com'
on conflict (user_id) do nothing;

-- Admin policies complement the customer policies in commerce-setup.sql.
create policy "admin_profiles_read" on public.profiles for select to authenticated using ((select public.is_admin()));
create policy "admin_models_manage" on public.product_models for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_variants_manage" on public.product_variants for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_product_types_manage" on public.catalog_product_types for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_collections_manage" on public.catalog_collections for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_catalog_designs_manage" on public.catalog_designs for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_orders_read" on public.orders for select to authenticated using ((select public.is_admin()));
create policy "admin_order_items_read" on public.order_items for select to authenticated using ((select public.is_admin()));
create policy "admin_order_history_read" on public.order_status_history for select to authenticated using ((select public.is_admin()));
create policy "admin_payments_read" on public.payments for select to authenticated using ((select public.is_admin()));
