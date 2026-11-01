alter table public.catalog_collections
  add column if not exists home_design_limit integer not null default 4;

alter table public.catalog_collections
  drop constraint if exists catalog_collections_home_design_limit_check;

alter table public.catalog_collections
  add constraint catalog_collections_home_design_limit_check
  check (home_design_limit between 1 and 12);
