-- Evita que PL/pgSQL confunda la variable del modelo con la columna homónima.
create or replace function public.sync_sellable_clothing_variants()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare
  item public.supplier_products%rowtype;
  category_slug text; target_model_code text; model_id bigint; size_label text;
  sku_prefix text; sellable boolean;
begin
  item:=case when tg_op='DELETE' then old else new end;
  select slug into category_slug from public.supplier_categories where id=item.category_id;
  if category_slug not in ('poleras','polera-mujer-basica','poleras-oversize','poleras-ninos') then return null; end if;
  target_model_code:=case category_slug when 'poleras' then 'basic'
    when 'polera-mujer-basica' then 'woman' when 'poleras-oversize' then 'over' else 'kid' end;
  select size.size_code into size_label from public.catalog_product_sizes size
  where size.id=item.catalog_product_size_id and size.model_code=target_model_code;
  if size_label is null then raise exception 'El insumo % no tiene una talla configurada',item.id; end if;
  select id into model_id from public.product_models where code=target_model_code;
  if model_id is null then raise exception 'Falta el modelo comercial %',target_model_code; end if;
  sku_prefix:=case target_model_code when 'basic' then 'DR-BSC-' when 'woman' then 'DR-WMN-'
    when 'over' then 'DR-OVR-' else 'DR-KID-' end;
  sellable:=tg_op<>'DELETE' and item.active and item.confirmed_price_clp>0
    and item.price_confirmed_at is not null;
  if sellable then
    insert into public.product_variants
      (product_model_id,sku,size,color_name,color_hex,price_clp,personalization_base_price_clp,active)
    select distinct on (regexp_replace(template.sku,'^.*-','')) model_id,
      sku_prefix || (case when target_model_code='kid' then substring(size_label from '^[0-9]+')
        else regexp_replace(size_label,'[^0-9A-Za-z]+','','g') end)
        || '-' || regexp_replace(template.sku,'^.*-',''),
      size_label,template.color_name,template.color_hex,item.confirmed_price_clp,
      item.personalization_base_price_clp,true
    from public.product_variants template
    where template.product_model_id=model_id and template.active and template.size<>size_label
    order by regexp_replace(template.sku,'^.*-',''),template.size
    on conflict (sku) do update set product_model_id=excluded.product_model_id,
      size=excluded.size,color_name=excluded.color_name,color_hex=excluded.color_hex,
      price_clp=excluded.price_clp,
      personalization_base_price_clp=excluded.personalization_base_price_clp,
      active=true,updated_at=now();
    insert into public.supplier_product_variants (supplier_product_id,product_variant_id)
    select item.id,variant.id from public.product_variants variant
    where variant.product_model_id=model_id and variant.size=size_label and variant.active
    on conflict do nothing;
  else
    update public.product_variants variant set active=false,updated_at=now()
    where variant.product_model_id=model_id and variant.size=size_label and variant.active;
  end if;
  return null;
end;
$$;
