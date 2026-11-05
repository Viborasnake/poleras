alter table public.storefront_settings
  add column if not exists front_large_clp integer not null default 5990 check (front_large_clp between 0 and 1000000),
  add column if not exists front_pocket_clp integer not null default 2990 check (front_pocket_clp between 0 and 1000000),
  add column if not exists back_large_clp integer not null default 5990 check (back_large_clp between 0 and 1000000),
  add column if not exists arm_clp integer not null default 2990 check (arm_clp between 0 and 1000000);
