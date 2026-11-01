-- Solo se muestran edades infantiles que tienen un insumo activo y un
-- precio de venta confirmado. Se conservan las filas para pedidos históricos.
update public.product_variants as variant
set active = false,
    updated_at = now()
from public.product_models as model
where model.id = variant.product_model_id
  and model.code = 'kid'
  and variant.active
  and not exists (
    select 1
    from public.supplier_products as supplier
    join public.supplier_categories as category
      on category.id = supplier.category_id
    where category.slug = 'poleras-ninos'
      and supplier.name = variant.size
      and supplier.active
      and supplier.confirmed_price_clp > 0
      and supplier.price_confirmed_at is not null
  );
