alter table public.catalog_designs
  add column if not exists mockup_hover_focus_x numeric not null default 50,
  add column if not exists mockup_hover_focus_y numeric not null default 50;

alter table public.catalog_designs
  drop constraint if exists catalog_designs_mockup_hover_focus_x_range,
  add constraint catalog_designs_mockup_hover_focus_x_range
    check (mockup_hover_focus_x between 0 and 100),
  drop constraint if exists catalog_designs_mockup_hover_focus_y_range,
  add constraint catalog_designs_mockup_hover_focus_y_range
    check (mockup_hover_focus_y between 0 and 100);

comment on column public.catalog_designs.mockup_hover_focus_x is
  'Porcentaje horizontal del foco aplicado al mockup alternativo del catálogo.';

comment on column public.catalog_designs.mockup_hover_focus_y is
  'Porcentaje vertical del foco aplicado al mockup alternativo del catálogo.';
