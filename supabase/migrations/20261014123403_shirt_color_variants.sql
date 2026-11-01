-- Los tonos publicados comparten el precio de la variante blanca de cada
-- modelo/talla activa. No se crean tallas adultas retiradas ni variantes de
-- tote/body. Los HEX son muestras digitales para el visor 3D.
insert into public.product_variants
  (product_model_id, sku, size, color_name, color_hex, price_clp, active)
select
  white_variant.product_model_id,
  regexp_replace(white_variant.sku, '-WHT$', '-' || color.sku_suffix),
  white_variant.size,
  color.name,
  color.hex,
  white_variant.price_clp,
  true
from public.product_variants as white_variant
join public.product_models as model
  on model.id = white_variant.product_model_id
cross join (values
  ('BLK', 'Negro', '#202124'),
  ('SKY', 'Celeste', '#9BD7F0'),
  ('ROY', 'Azul rey', '#2B50A2'),
  ('NVY', 'Azul marino', '#1D3557'),
  ('DBL', 'Azul oscuro', '#17243D'),
  ('BGE', 'Beige', '#D9C7A4'),
  ('CAF', 'Café', '#755139'),
  ('DCF', 'Café oscuro', '#4A2C25')
) as color(sku_suffix, name, hex)
where model.code in ('basic', 'woman', 'over', 'kid')
  and model.active
  and white_variant.active
  and lower(white_variant.color_hex) = '#ffffff'
  and white_variant.sku like '%-WHT'
on conflict (sku) do update
set size = excluded.size,
    color_name = excluded.color_name,
    color_hex = excluded.color_hex,
    price_clp = excluded.price_clp,
    active = excluded.active,
    updated_at = now();
