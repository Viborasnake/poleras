-- El producto se administra desde Insumos, pero no aparece en venta hasta
-- publicar un precio para una talla mensual. La muestra de color es digital.
insert into public.catalog_product_types
  (slug, name, menu_description, active, sort_order)
values ('bodys', 'Bodys', 'Diseños para los más pequeños', false, 15)
on conflict (slug) do nothing;

create or replace function public.sync_body_variants_from_supplier()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  item public.supplier_products%rowtype;
  body_model_id bigint;
  size_label text;
  size_code text;
  sellable boolean;
begin
  if TG_OP = 'DELETE' then
    item := OLD;
  else
    item := NEW;
  end if;

  if not exists (
    select 1 from public.supplier_categories
    where id = item.category_id and slug = 'bodys'
  ) then
    return null;
  end if;

  size_label := case item.slug
    when '0-3-meses' then '0-3 meses'
    when '3-6-meses' then '3-6 meses'
    when '6-12-meses' then '6-12 meses'
    when '12-24-meses' then '12-24 meses'
  end;
  size_code := case item.slug
    when '0-3-meses' then '03'
    when '3-6-meses' then '36'
    when '6-12-meses' then '612'
    when '12-24-meses' then '1224'
  end;
  if size_label is null then
    return null;
  end if;

  select id into body_model_id
  from public.product_models
  where code = 'body';
  if body_model_id is null then
    raise exception 'Falta el modelo comercial body';
  end if;

  sellable := TG_OP <> 'DELETE'
    and item.active
    and item.confirmed_price_clp > 0
    and item.price_confirmed_at is not null;

  if sellable then
    insert into public.product_variants
      (product_model_id, sku, size, color_name, color_hex, price_clp, active)
    select body_model_id, 'DR-BDY-' || size_code || '-' || color.suffix,
      size_label, color.name, color.hex, item.confirmed_price_clp, true
    from (values
      ('WHT', 'Blanco', '#FFFFFF'),
      ('RED', 'Rojo', '#C73532'),
      ('DBL', 'Azul oscuro', '#17243D'),
      ('DCF', 'Café oscuro', '#4A2C25'),
      ('GRY', 'Gris', '#85878A')
    ) as color(suffix, name, hex)
    on conflict (sku) do update
    set product_model_id = excluded.product_model_id,
        size = excluded.size,
        color_name = excluded.color_name,
        color_hex = excluded.color_hex,
        price_clp = excluded.price_clp,
        active = true,
        updated_at = now();

    insert into public.supplier_product_variants
      (supplier_product_id, product_variant_id)
    select item.id, variant.id
    from public.product_variants as variant
    where variant.product_model_id = body_model_id
      and variant.size = size_label
      and variant.sku like 'DR-BDY-' || size_code || '-%'
    on conflict do nothing;
  else
    update public.product_variants as variant
    set active = false, updated_at = now()
    where variant.product_model_id = body_model_id
      and variant.size = size_label
      and variant.active;
  end if;

  insert into public.catalog_product_types
    (slug, name, menu_description, active, sort_order)
  values (
    'bodys', 'Bodys', 'Diseños para los más pequeños',
    exists (
      select 1 from public.product_variants as variant
      where variant.product_model_id = body_model_id and variant.active
    ),
    15
  )
  on conflict (slug) do update
  set active = excluded.active,
      updated_at = now();

  return null;
end;
$$;

drop trigger if exists sync_body_variants_from_supplier on public.supplier_products;
create trigger sync_body_variants_from_supplier
after insert or update or delete on public.supplier_products
for each row execute function public.sync_body_variants_from_supplier();
