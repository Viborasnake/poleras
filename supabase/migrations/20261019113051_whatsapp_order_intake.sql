-- Cada apertura de WhatsApp crea una solicitud trazable para el panel.
alter table public.orders
  add column if not exists whatsapp_request_id uuid;

create unique index if not exists orders_whatsapp_request_id_key
  on public.orders (whatsapp_request_id)
  where whatsapp_request_id is not null;

alter table public.orders drop constraint if exists orders_source_check;
alter table public.orders add constraint orders_source_check
  check (source in ('online', 'manual', 'idea_request', 'whatsapp'));

create index if not exists orders_whatsapp_created_idx
  on public.orders (created_at desc)
  where source = 'whatsapp';
