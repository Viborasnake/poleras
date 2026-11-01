-- La portada pública guarda únicamente las referencias de diseños ya
-- publicados. Los archivos siguen viviendo en Cloudflare R2.
alter table public.storefront_settings
  add column if not exists hero_catalog_design_ids bigint[] not null default '{}';

alter table public.storefront_settings
  drop constraint if exists storefront_settings_hero_catalog_design_ids_check,
  add constraint storefront_settings_hero_catalog_design_ids_check
    check (cardinality(hero_catalog_design_ids) <= 3);
