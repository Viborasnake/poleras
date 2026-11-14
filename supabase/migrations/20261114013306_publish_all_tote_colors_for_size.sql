-- El insumo de Tote Bag define talla y precio. El cliente elige el color.
create or replace function public.publish_supplier_product_price(
  p_supplier_product_id bigint,
  p_price_clp integer
)
returns table (supplier_product_id bigint, published_variant_count bigint)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  published_count bigint;
  published_product_id bigint;
  item public.supplier_products%rowtype;
  category_slug text;
  tote_size text;
  tote_variant_ids bigint[];
begin
  if not (select public.is_admin()) then
    raise exception 'Solo una cuenta administradora puede publicar precios';
  end if;
  if p_price_clp is null or p_price_clp <= 0 then
    raise exception 'El precio debe ser mayor que cero';
  end if;

  select * into item from public.supplier_products
  where id = p_supplier_product_id for update;
  if not found then
    raise exception 'No encontramos el producto de proveedor %', p_supplier_product_id;
  end if;
  select slug into category_slug from public.supplier_categories
  where id = item.category_id;

  if category_slug = 'tote-bag' and item.kind = 'garment' then
    select size.size_code into tote_size from public.catalog_product_sizes size
    where size.id = item.catalog_product_size_id and size.model_code = 'tote';
    if tote_size is null then
      raise exception 'Selecciona una talla de Tote Bag en Productos → Tallas';
    end if;

    select array_agg(distinct variant.id) into tote_variant_ids
    from public.product_variants as variant
    join public.product_models as model on model.id = variant.product_model_id
    join public.catalog_colors as color on lower(variant.color_hex) = color.hex
    join public.product_color_availability as availability
      on availability.product_slug = 'totebags' and availability.color_code = color.code
    where model.code = 'tote' and model.active
      and variant.size = tote_size
      and color.active and availability.active;
    if coalesce(array_length(tote_variant_ids,1),0) = 0 then
      raise exception 'No hay colores habilitados con variantes de Tote Bag para esta talla';
    end if;

    update public.product_variants set active=true,updated_at=now()
    where id=any(tote_variant_ids) and not active;

    delete from public.supplier_product_variants as link
    using public.supplier_products as other
    where link.supplier_product_id = other.id
      and other.category_id = item.category_id
      and other.id <> item.id
      and link.product_variant_id = any(tote_variant_ids);

    delete from public.supplier_product_variants as own_link
    where own_link.supplier_product_id = item.id
      and own_link.product_variant_id <> all(tote_variant_ids);

    insert into public.supplier_product_variants
      (supplier_product_id, product_variant_id)
    select item.id, variants.variant_id
    from unnest(tote_variant_ids) as variants(variant_id)
    on conflict do nothing;
  end if;

  update public.supplier_products
  set confirmed_price_clp = p_price_clp,
      price_confirmed_at = now(),
      price_confirmed_by = auth.uid(),
      model_code = case when category_slug = 'tote-bag' and item.kind = 'garment'
        then 'tote' else model_code end,
      updated_at = now()
  where id = p_supplier_product_id
  returning id into published_product_id;

  update public.product_variants as variant
  set price_clp = p_price_clp,
      updated_at = now()
  where exists (
    select 1 from public.supplier_product_variants as link
    where link.supplier_product_id = p_supplier_product_id
      and link.product_variant_id = variant.id
  );
  get diagnostics published_count = row_count;
  if published_count = 0 then
    raise exception 'Este producto no tiene variantes vinculadas para publicar';
  end if;

  return query select published_product_id, published_count;
end;
$$;

revoke all on function public.publish_supplier_product_price(bigint, integer) from public, anon;
grant execute on function public.publish_supplier_product_price(bigint, integer) to authenticated;

comment on function public.publish_supplier_product_price(bigint, integer) is
  'Publica el precio de Tote Bag para todos los colores habilitados de la talla configurada; el cliente elige color al comprar.';
