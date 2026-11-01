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
begin
  if not (select public.is_admin()) then
    raise exception 'Solo una cuenta administradora puede publicar precios';
  end if;

  if p_price_clp is null or p_price_clp <= 0 then
    raise exception 'El precio debe ser mayor que cero';
  end if;

  update public.supplier_products
  set confirmed_price_clp = p_price_clp,
      price_confirmed_at = now(),
      price_confirmed_by = auth.uid(),
      updated_at = now()
  where id = p_supplier_product_id
  returning id into published_product_id;

  if published_product_id is null then
    raise exception 'No encontramos el producto de proveedor %', p_supplier_product_id;
  end if;

  update public.product_variants as variant
  set price_clp = p_price_clp,
      updated_at = now()
  where exists (
    select 1
    from public.supplier_product_variants as link
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
  'Confirma el precio de un insumo y actualiza todas sus variantes vinculadas dentro de una sola transacción.';
