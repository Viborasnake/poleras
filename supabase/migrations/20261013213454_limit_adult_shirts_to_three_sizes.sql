-- La tienda solo vende poleras adultas en las tres variantes abastecidas:
-- Pequeña (S), Mediana (M) y Grande (L). Conservamos las filas históricas
-- para no romper pedidos anteriores, pero dejan de estar disponibles.
update public.product_variants as variant
set active = false,
    updated_at = now()
from public.product_models as model
where variant.product_model_id = model.id
  and model.code in ('basic', 'over', 'woman')
  and variant.size not in ('S', 'M', 'L')
  and variant.active = true;
