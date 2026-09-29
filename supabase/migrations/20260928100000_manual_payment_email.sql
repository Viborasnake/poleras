-- Datos de pago para pedidos manuales y trazabilidad del email enviado.

alter table public.orders
  add column if not exists payment_instructions jsonb,
  add column if not exists payment_email_sent_at timestamptz,
  add column if not exists payment_email_sent_by uuid references auth.users(id) on delete set null;
