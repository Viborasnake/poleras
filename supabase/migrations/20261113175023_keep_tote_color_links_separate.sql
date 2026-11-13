-- Los nuevos colores tote no heredan por tamaño el insumo de otro color.
create or replace function private.sync_product_color_variants(_product_slug text)
returns void
language plpgsql
security invoker
set search_path=''
as $$
declare
  model_codes text[];
begin
  if current_user not in ('postgres','supabase_admin') and not (select public.is_admin()) then
    raise exception 'No autorizado.' using errcode='42501';
  end if;
  model_codes:=case _product_slug
    when 'poleras' then array['basic','woman','over','kid']
    when 'bodys' then array['body']
    when 'totebags' then array['tote']
    else null
  end;
  if model_codes is null then raise exception 'El producto no administra colores.'; end if;

  create temporary table if not exists droska_color_active_sizes (
    model_id bigint,size text,price_clp integer,template_sku text,primary key(model_id,size)
  ) on commit drop;
  truncate table pg_temp.droska_color_active_sizes;
  insert into pg_temp.droska_color_active_sizes (model_id,size,price_clp,template_sku)
  select distinct on (variant.product_model_id,variant.size)
    variant.product_model_id,variant.size,variant.price_clp,variant.sku
  from public.product_variants as variant
  join public.product_models as model on model.id=variant.product_model_id
  where model.code=any(model_codes) and variant.active
  order by variant.product_model_id,variant.size,variant.id;

  if not exists (select 1 from pg_temp.droska_color_active_sizes) then return; end if;

  insert into public.product_variants
    (product_model_id,sku,size,color_name,color_hex,price_clp,active)
  select size.model_id,
    regexp_replace(size.template_sku,'-[^-]+$','-'||color.sku_suffix),
    size.size,color.name,upper(color.hex),size.price_clp,true
  from pg_temp.droska_color_active_sizes as size
  join public.product_color_availability as availability
    on availability.product_slug=_product_slug and availability.active
  join public.catalog_colors as color on color.code=availability.color_code and color.active
  where not exists (
    select 1 from public.product_variants as existing
    where existing.product_model_id=size.model_id and existing.size=size.size
      and lower(existing.color_hex)=color.hex
  )
  on conflict (sku) do update set
    product_model_id=excluded.product_model_id,size=excluded.size,color_name=excluded.color_name,
    color_hex=excluded.color_hex,active=true,updated_at=now();

  insert into public.supplier_product_variants (supplier_product_id,product_variant_id)
  select distinct link.supplier_product_id,target.id
  from pg_temp.droska_color_active_sizes as size
  join public.product_variants as source
    on source.product_model_id=size.model_id and source.size=size.size
  join public.supplier_product_variants as link on link.product_variant_id=source.id
  join public.product_variants as target
    on target.product_model_id=size.model_id and target.size=size.size
  join public.catalog_colors as color on lower(target.color_hex)=color.hex
  join public.product_color_availability as availability
    on availability.product_slug=_product_slug and availability.color_code=color.code and availability.active
    and (_product_slug <> 'totebags' or lower(source.color_hex)=lower(target.color_hex))
  on conflict do nothing;

  update public.product_variants as variant
  set active=(
    exists (select 1 from pg_temp.droska_color_active_sizes as size where size.model_id=variant.product_model_id and size.size=variant.size)
    and variant.id=(
      select min(candidate.id) from public.product_variants as candidate
      where candidate.product_model_id=variant.product_model_id and candidate.size=variant.size
        and lower(candidate.color_hex)=lower(variant.color_hex)
    )
    and exists (
      select 1 from public.product_color_availability as availability
      join public.catalog_colors as color on color.code=availability.color_code
      where availability.product_slug=_product_slug and availability.active and color.hex=lower(variant.color_hex)
    )
  ),updated_at=now()
  where variant.product_model_id in (select id from public.product_models where code=any(model_codes));
end;
$$;
