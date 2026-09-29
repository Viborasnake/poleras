alter table public.orders
  add column if not exists edit_pending_snapshot jsonb;
