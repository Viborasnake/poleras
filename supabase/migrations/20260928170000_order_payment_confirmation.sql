-- Confirmación manual del pago antes de iniciar producción.

alter table public.orders
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists payment_confirmed_by uuid references auth.users(id) on delete set null;
