alter table public.order_items
  add column if not exists print_configuration jsonb not null default '{}'::jsonb;

alter table public.order_items
  drop constraint if exists order_items_print_configuration_object;

alter table public.order_items
  add constraint order_items_print_configuration_object
  check (jsonb_typeof(print_configuration) = 'object');
