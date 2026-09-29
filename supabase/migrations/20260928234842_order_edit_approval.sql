-- Permite guardar una edición como borrador operativo y aprobar explícitamente
-- el correo antes de comunicar los cambios al cliente.
alter table public.orders
  add column if not exists edit_pending_approval boolean not null default false,
  add column if not exists edit_pending_at timestamptz,
  add column if not exists edit_pending_by uuid references auth.users(id) on delete set null,
  add column if not exists order_edit_version integer not null default 0,
  add column if not exists order_edit_email_sent_at timestamptz,
  add column if not exists order_edit_email_sent_by uuid references auth.users(id) on delete set null;

create index if not exists orders_edit_pending_idx
  on public.orders(edit_pending_approval, updated_at desc)
  where edit_pending_approval = true;
