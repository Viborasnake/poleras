alter table public.catalog_designs
  add column if not exists polera_prints jsonb not null default '{}'::jsonb;

alter table public.catalog_designs
  add constraint catalog_designs_polera_prints_object
  check (
    jsonb_typeof(polera_prints) = 'object'
    and coalesce(polera_prints->>'primary', 'front') in
      ('front', 'back', 'pocket-left', 'pocket-right', 'arm-left', 'arm-right', 'arms')
    and jsonb_typeof(coalesce(polera_prints->'additional', '{}'::jsonb)) = 'object'
    and jsonb_typeof(coalesce(polera_prints->'mockups', '{}'::jsonb)) = 'object'
  );

comment on column public.catalog_designs.polera_prints is
  'Ubicación del arte principal de Poleras y rutas de estampados adicionales y mockups por ubicación.';
