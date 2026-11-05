alter table public.storefront_settings
  add column if not exists quality_review_fee_clp integer not null default 4990
    constraint storefront_settings_quality_review_fee_check check (quality_review_fee_clp between 0 and 1000000);

comment on column public.storefront_settings.quality_review_fee_clp is
  'Monto adicional por producto cuando el archivo del cliente requiere revisión técnica.';
