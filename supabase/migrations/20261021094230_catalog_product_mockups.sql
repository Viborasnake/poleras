-- Keep historical columns and immutable image URLs for older storefronts.
alter table public.catalog_designs
  add column if not exists product_mockups jsonb not null default '{}'::jsonb
  constraint catalog_designs_product_mockups_object check (jsonb_typeof(product_mockups) = 'object');

-- The merchant's historical upload order is shirt first, tote second.
update public.catalog_designs
set product_mockups =
  case when nullif(mockup_path, '') is not null then
    jsonb_build_object('poleras', jsonb_build_object('path', mockup_path,
      'focusX', coalesce(mockup_focus_x, 50), 'focusY', coalesce(mockup_focus_y, 50)))
  else '{}'::jsonb end
  || case when nullif(mockup_hover_path, '') is not null then
    jsonb_build_object('totebags', jsonb_build_object('path', mockup_hover_path,
      'focusX', coalesce(mockup_hover_focus_x, 50), 'focusY', coalesce(mockup_hover_focus_y, 50)))
  else '{}'::jsonb end
where product_mockups = '{}'::jsonb;

comment on column public.catalog_designs.product_mockups is
  'Mockups keyed by catalog product slug, with path, focusX/Y and optional same-product hoverPath/hoverFocusX/Y. Historical first image is poleras, second is totebags.';
