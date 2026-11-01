alter table public.catalog_designs
  add column if not exists allowed_product_colors jsonb not null default '{}'::jsonb;

alter table public.catalog_designs
  drop constraint if exists catalog_designs_allowed_product_colors_format,
  add constraint catalog_designs_allowed_product_colors_format check (
    jsonb_typeof(allowed_product_colors)='object'
    and allowed_product_colors-'poleras'-'bodys'-'totebags'='{}'::jsonb
    and (not (allowed_product_colors?'poleras') or (jsonb_typeof(allowed_product_colors->'poleras')='array' and jsonb_array_length(allowed_product_colors->'poleras')>0))
    and (not (allowed_product_colors?'bodys') or (jsonb_typeof(allowed_product_colors->'bodys')='array' and jsonb_array_length(allowed_product_colors->'bodys')>0))
    and (not (allowed_product_colors?'totebags') or (jsonb_typeof(allowed_product_colors->'totebags')='array' and jsonb_array_length(allowed_product_colors->'totebags')>0))
  );

with design_products as (
  select design.id,product.slug,design.allowed_colors
  from public.catalog_designs as design
  cross join lateral jsonb_object_keys(coalesce(design.product_artworks,'{}'::jsonb)) as product(slug)
  where product.slug in ('poleras','bodys','totebags')
  union
  select design.id,product_type.slug,design.allowed_colors
  from public.catalog_designs as design
  join public.catalog_collections as collection on collection.id=design.collection_id
  join public.catalog_product_types as product_type on product_type.id=collection.product_type_id
  where product_type.slug in ('poleras','bodys','totebags')
    and not exists (
      select 1 from jsonb_object_keys(coalesce(design.product_artworks,'{}'::jsonb)) as artwork(slug)
      where artwork.slug in ('poleras','bodys','totebags')
    )
), available as (
  select product.id,product.slug,
    coalesce(
      nullif(array_agg(distinct lower(variant.color_hex) order by lower(variant.color_hex)) filter (
        where product.allowed_colors is null or lower(variant.color_hex)=any(product.allowed_colors)
      ),'{}'::text[]),
      array_agg(distinct lower(variant.color_hex) order by lower(variant.color_hex))
    ) as colors
  from design_products as product
  join public.product_models as model on model.active and (
    (product.slug='poleras' and model.code in ('basic','woman','over','kid'))
    or (product.slug='bodys' and model.code='body')
    or (product.slug='totebags' and model.code='tote')
  )
  join public.product_variants as variant on variant.product_model_id=model.id and variant.active
  group by product.id,product.slug,product.allowed_colors
), mapped as (
  select id,jsonb_object_agg(slug,to_jsonb(colors)) as colors
  from available
  group by id
)
update public.catalog_designs as design
set allowed_product_colors=mapped.colors
from mapped
where mapped.id=design.id;

update public.catalog_designs as design
set allowed_colors=(
  select array_agg(distinct lower(color) order by lower(color))
  from jsonb_each(design.allowed_product_colors) as product(slug,colors)
  cross join lateral jsonb_array_elements_text(product.colors) as selected(color)
)
where design.allowed_product_colors<>'{}'::jsonb;

comment on column public.catalog_designs.allowed_product_colors is
  'Subset of the global active palette selected for each linked product. Keys are poleras, bodys and totebags.';

