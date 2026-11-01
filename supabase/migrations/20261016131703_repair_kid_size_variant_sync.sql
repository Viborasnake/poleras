-- Las edades deben reconocerse sin barras escapadas de más.
-- Publicar un precio crea o reactiva las variantes de esa talla y las vincula al insumo.
create or replace function public.sync_sellable_clothing_variants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  item public.supplier_products%rowtype;
  category_slug text;
  model_code text;
  model_id bigint;
  size_label text;
  sku_prefix text;
  sellable boolean;
begin
  item := case when TG_OP = 'DELETE' then OLD else NEW end;
  select slug into category_slug from public.supplier_categories where id = item.category_id;
  if category_slug not in ('poleras', 'polera-mujer-basica', 'poleras-oversize', 'poleras-ninos') then return null; end if;

  if category_slug = 'poleras-ninos' then
    model_code := 'kid';
    size_label := substring(btrim(item.name) from '^([0-9]+)[[:space:]]*años?$');
    if size_label is not null then size_label := size_label || ' años'; end if;
  else
    model_code := case category_slug when 'poleras' then 'basic' when 'polera-mujer-basica' then 'woman' else 'over' end;
    size_label := case lower(btrim(item.name)) when 'pequeña' then 'S' when 'pequena' then 'S' when 'mediana' then 'M' when 'grande' then 'L' when 'extra grande' then 'XL' when 'extragrande' then 'XL' end;
  end if;
  if size_label is null then return null; end if;

  select id into model_id from public.product_models where code = model_code;
  if model_id is null then raise exception 'Falta el modelo comercial %', model_code; end if;
  sku_prefix := case model_code when 'basic' then 'DR-BSC-' when 'woman' then 'DR-WMN-' when 'over' then 'DR-OVR-' else 'DR-KID-' end;
  sellable := TG_OP <> 'DELETE' and item.active and item.confirmed_price_clp > 0 and item.price_confirmed_at is not null;

  if sellable then
    insert into public.product_variants (product_model_id, sku, size, color_name, color_hex, price_clp, active)
    select distinct on (regexp_replace(template.sku, '^.*-', '')) model_id,
      sku_prefix || regexp_replace(size_label, '[^0-9A-Za-z]+', '', 'g') || '-' || regexp_replace(template.sku, '^.*-', ''),
      size_label, template.color_name, template.color_hex, item.confirmed_price_clp, true
    from public.product_variants as template
    where template.product_model_id = model_id and template.active and template.size <> size_label
    order by regexp_replace(template.sku, '^.*-', ''), template.size
    on conflict (sku) do update set product_model_id = excluded.product_model_id, size = excluded.size, color_name = excluded.color_name, color_hex = excluded.color_hex, price_clp = excluded.price_clp, active = true, updated_at = now();

    insert into public.supplier_product_variants (supplier_product_id, product_variant_id)
    select item.id, variant.id from public.product_variants as variant
    where variant.product_model_id = model_id and variant.size = size_label and variant.active
    on conflict do nothing;
  else
    update public.product_variants as variant set active = false, updated_at = now()
    where variant.product_model_id = model_id and variant.size = size_label and variant.active;
  end if;
  return null;
end;
$$;

-- Repara solo los 18 vínculos faltantes de 2 y 3 años, ya publicados a $12.990.
-- Las edades sin precio siguen ocultas.
update public.supplier_products as supplier
set updated_at = now()
from public.supplier_categories as category
where category.id = supplier.category_id
  and category.slug = 'poleras-ninos'
  and supplier.name in ('2 años', '3 años')
  and supplier.active
  and supplier.confirmed_price_clp > 0
  and supplier.price_confirmed_at is not null;
