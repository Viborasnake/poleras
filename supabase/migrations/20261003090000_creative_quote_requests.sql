-- Solicitudes de diseño desde cero: llegan al panel como pedidos por cotizar.
alter table public.orders add column if not exists request_type text not null default 'purchase';
alter table public.orders add column if not exists request_details text;
alter table public.orders add column if not exists request_references jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists quote_message text;
alter table public.orders add column if not exists quoted_total_clp integer;
alter table public.orders add column if not exists quoted_at timestamptz;
alter table public.orders add column if not exists quoted_by uuid references auth.users(id) on delete set null;

alter table public.orders drop constraint if exists orders_request_type_check;
alter table public.orders add constraint orders_request_type_check check (request_type in ('purchase', 'creative'));

create index if not exists orders_request_type_created_idx on public.orders(request_type, created_at desc);

alter table public.orders drop constraint if exists orders_source_check;
alter table public.orders add constraint orders_source_check check (source in ('online', 'manual', 'idea_request'));
