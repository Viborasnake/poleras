alter table public.catalog_designs
  add column if not exists personalization_arrow_x numeric not null default 50,
  add column if not exists personalization_arrow_y numeric not null default 50;

alter table public.catalog_designs
  drop constraint if exists catalog_designs_personalization_arrow_x_range,
  add constraint catalog_designs_personalization_arrow_x_range
    check (personalization_arrow_x between 0 and 100),
  drop constraint if exists catalog_designs_personalization_arrow_y_range,
  add constraint catalog_designs_personalization_arrow_y_range
    check (personalization_arrow_y between 0 and 100);

comment on column public.catalog_designs.personalization_arrow_x is
  'Horizontal target (0-100) for the personalization story arrow in catalog cards.';

comment on column public.catalog_designs.personalization_arrow_y is
  'Vertical target (0-100) for the personalization story arrow in catalog cards.';
