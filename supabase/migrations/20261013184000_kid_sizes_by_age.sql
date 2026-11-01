-- Las poleras infantiles se venden por edad, no por talla adulta.
-- Conserva las variantes existentes y sus precios, actualizando solo su etiqueta y SKU.
with kid_sizes (old_sku, size, sku) as (
  values
    ('DR-KID-XS-WHT', '2 años', 'DR-KID-2-WHT'),
    ('DR-KID-S-WHT', '3 años', 'DR-KID-3-WHT'),
    ('DR-KID-M-WHT', '4 años', 'DR-KID-4-WHT'),
    ('DR-KID-L-WHT', '6 años', 'DR-KID-6-WHT'),
    ('DR-KID-XL-WHT', '8 años', 'DR-KID-8-WHT'),
    ('DR-KID-XXL-WHT', '10 años', 'DR-KID-10-WHT')
)
update public.product_variants variant
set size = kid_sizes.size,
    sku = kid_sizes.sku,
    updated_at = now()
from kid_sizes, public.product_models model
where model.code = 'kid'
  and model.id = variant.product_model_id
  and variant.sku = kid_sizes.old_sku;
