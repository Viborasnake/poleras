-- Metadata editorial and configuration shared by Administration, storefront,
-- static catalog generation and the personalization flow.
alter table public.catalog_collections
  add column if not exists is_featured boolean not null default false;

alter table public.catalog_designs
  add column if not exists accepts_customer_image boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists allowed_colors text[];

alter table public.catalog_designs
  drop constraint if exists catalog_designs_allowed_colors_format,
  add constraint catalog_designs_allowed_colors_format check (
    allowed_colors is null
    or (
      cardinality(allowed_colors) > 0
      and array_position(allowed_colors, null) is null
      and array_to_string(allowed_colors, ',') ~ '^#[0-9a-f]{6}(,#[0-9a-f]{6})*$'
    )
  );

comment on column public.catalog_collections.is_featured is
  'Editorial priority flag. Ordering is applied by storefront consumers.';
comment on column public.catalog_designs.accepts_customer_image is
  'The design starts from a customer-provided image while retaining its catalog identity.';
comment on column public.catalog_designs.is_featured is
  'Editorial priority flag. Ordering is applied by storefront consumers.';
comment on column public.catalog_designs.allowed_colors is
  'Explicit allowed garment colors as normalized hex values. NULL means legacy configuration pending review.';
