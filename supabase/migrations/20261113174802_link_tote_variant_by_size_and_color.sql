-- La publicación de una tote reconoce la talla y el color del insumo.
-- Un mismo SKU no puede recibir precios de dos insumos de la categoría Tote Bag.
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
  tote_color_code text;
  tote_variant_id bigint;
  tote_variant_count bigint;
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
    tote_size := case
      when item.name ~* '(^|[[:space:]])mediana([[:space:]]|$)' then 'M'
      when item.name ~* '(^|[[:space:]])grande([[:space:]]|$)' then 'L'
    end;
    tote_color_code := case
      when item.name ~* '(^|[[:space:]])negr[ao]([[:space:]]|$)' then 'black'
      when item.name ~* '(^|[[:space:]])(crud[ao]|beige|natural)([[:space:]]|$)' then 'beige'
    end;

    if tote_size is not null and tote_color_code is not null then
      select count(*), min(variant.id)
      into tote_variant_count, tote_variant_id
      from public.product_variants as variant
      join public.product_models as model on model.id = variant.product_model_id
      join public.catalog_colors as color on lower(variant.color_hex) = color.hex
      where model.code = 'tote' and model.active
        and variant.size = tote_size and variant.active
        and color.code = tote_color_code and color.active;

      if tote_variant_count <> 1 then
        raise exception 'No hay una variante única y activa de Tote Bag para este color y talla';
      end if;

      delete from public.supplier_product_variants as link
      using public.supplier_products as other
      where link.supplier_product_id = other.id
        and other.category_id = item.category_id
        and other.id <> item.id
        and link.product_variant_id = tote_variant_id;

      delete from public.supplier_product_variants
      where supplier_product_id = item.id
        and product_variant_id <> tote_variant_id;

      insert into public.supplier_product_variants
        (supplier_product_id, product_variant_id)
      values (item.id, tote_variant_id)
      on conflict do nothing;
    end if;
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
  'Publica el precio y, para Tote Bag con color y talla reconocibles, vincula solo su variante exacta en la misma transacción.';
