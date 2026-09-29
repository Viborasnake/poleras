-- Archivado administrativo sin notificar al cliente.
alter table public.orders
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archived_from_status text;

create index if not exists orders_archived_idx
  on public.orders(archived_at desc)
  where archived_at is not null;
