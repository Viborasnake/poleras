create table public.admin_inventory_lots (
  id text primary key check (length(id) between 1 and 255),
  lot jsonb not null check (jsonb_typeof(lot) = 'object' and coalesce(lot->>'id', '') = id),
  revision uuid not null default gen_random_uuid(),
  deleted boolean not null default false
);

alter table public.admin_inventory_lots enable row level security;
revoke all on public.admin_inventory_lots from public, anon, authenticated;
grant select, insert, update on public.admin_inventory_lots to authenticated;

create policy admin_inventory_lots_admin_only on public.admin_inventory_lots
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create function public.restore_admin_inventory_lots(lots jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  restored integer;
begin
  insert into public.admin_inventory_lots as existing (id, lot)
  select item->>'id', item
  from jsonb_array_elements(lots) as items(item)
  order by item->>'id'
  on conflict (id) do update
  set lot = excluded.lot, deleted = false, revision = gen_random_uuid()
  where existing.deleted;

  get diagnostics restored = row_count;
  if exists (
    select 1 from jsonb_array_elements(lots) as items(item)
    join public.admin_inventory_lots as existing on existing.id = item->>'id'
    where existing.lot is distinct from item
  ) then
    raise exception 'El respaldo contiene una versión distinta de un lote existente. No se modificó el inventario.';
  end if;
  return restored;
end;
$$;

revoke all on function public.restore_admin_inventory_lots(jsonb) from public, anon;
grant execute on function public.restore_admin_inventory_lots(jsonb) to authenticated;
