-- Las variantes de color comparten la fuente de precio ya vinculada a la
-- variante blanca de su mismo modelo y talla. Solo copia vínculos existentes.
insert into public.supplier_product_variants
  (supplier_product_id, product_variant_id)
select distinct
  white_link.supplier_product_id,
  color_variant.id
from public.supplier_product_variants as white_link
join public.product_variants as white_variant
  on white_variant.id = white_link.product_variant_id
join public.product_models as model
  on model.id = white_variant.product_model_id
join public.product_variants as color_variant
  on color_variant.product_model_id = white_variant.product_model_id
  and color_variant.size = white_variant.size
  and color_variant.active
  and lower(color_variant.color_hex) in (
    '#202124', '#9bd7f0', '#2b50a2', '#1d3557',
    '#17243d', '#d9c7a4', '#755139', '#4a2c25'
  )
where model.code in ('basic', 'woman', 'over', 'kid')
  and white_variant.active
  and lower(white_variant.color_hex) = '#ffffff'
on conflict do nothing;
