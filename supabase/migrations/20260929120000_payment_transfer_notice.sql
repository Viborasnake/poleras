-- Aviso manual del cliente cuando informa que ya realizó una transferencia.
alter table public.orders
  add column if not exists payment_transfer_notice_at timestamptz,
  add column if not exists payment_transfer_notice_by uuid references auth.users(id) on delete set null;

create index if not exists orders_payment_transfer_notice_idx
  on public.orders(payment_transfer_notice_at desc)
  where payment_transfer_notice_at is not null;
