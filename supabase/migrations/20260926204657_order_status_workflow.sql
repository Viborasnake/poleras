-- Flujo operativo compartido entre el panel de administración y cada cliente.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'draft','submitted','quoted','awaiting_deposit','deposit_paid','in_design',
  'proposal_ready','approved','awaiting_balance','paid','in_production',
  'ready','shipped','delivered','cancelled'
));

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

-- Realtime respeta las políticas RLS: cada cliente solo recibe sus pedidos.
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
