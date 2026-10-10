alter table public.catalog_designs
  add column if not exists mockup_path text,
  add column if not exists mockup_hover_path text;

comment on column public.catalog_designs.mockup_path is
  'Foto editorial de la polera para usar como portada del diseño en el catálogo.';

comment on column public.catalog_designs.mockup_hover_path is
  'Foto editorial alternativa mostrada al pasar el cursor sobre la portada del diseño.';
