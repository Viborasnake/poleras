-- Las variantes S parten ocultas; se activan solo cuando un insumo S publica precio.
insert into public.product_variants
  (product_model_id,sku,size,color_name,color_hex,price_clp,personalization_base_price_clp,active)
select template.product_model_id,
  'DR-TOTE-S-' || color.sku_suffix,
  'S',color.name,upper(color.hex),0,template.personalization_base_price_clp,false
from public.product_variants template
join public.product_models model on model.id=template.product_model_id and model.code='tote'
join public.catalog_colors color on color.hex=lower(template.color_hex) and color.active
where template.size='M'
  and template.id=(
    select min(candidate.id) from public.product_variants candidate
    where candidate.product_model_id=template.product_model_id and candidate.size='M'
      and lower(candidate.color_hex)=lower(template.color_hex)
  )
on conflict (sku) do nothing;
