alter table public.storefront_settings
  add column if not exists catalog_purchase_method text not null default 'cart',
  add column if not exists personalized_purchase_method text not null default 'cart';

alter table public.storefront_settings
  drop constraint if exists storefront_settings_catalog_purchase_method_check,
  add constraint storefront_settings_catalog_purchase_method_check check (catalog_purchase_method in ('cart','whatsapp')),
  drop constraint if exists storefront_settings_personalized_purchase_method_check,
  add constraint storefront_settings_personalized_purchase_method_check check (personalized_purchase_method in ('cart','whatsapp'));

alter table public.catalog_product_types
  add column if not exists purchase_method text not null default 'inherit';

alter table public.catalog_product_types
  drop constraint if exists catalog_product_types_purchase_method_check,
  add constraint catalog_product_types_purchase_method_check check (purchase_method in ('inherit','cart','whatsapp'));

-- Las tablas ya tienen RLS y políticas; mantenemos privilegios explícitos para
-- que la configuración pública siga siendo legible y solo el admin la edite.
grant select on table public.storefront_settings to anon, authenticated;
grant update on table public.storefront_settings to authenticated;
grant select on table public.catalog_product_types to anon, authenticated;
grant insert, update, delete on table public.catalog_product_types to authenticated;
