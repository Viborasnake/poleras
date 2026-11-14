-- La talla comercial pertenece al producto y modelo. El insumo se vincula a
-- esa talla; su nombre deja de ser la fuente de verdad para publicar precios.
create table public.catalog_product_sizes (
  id bigint generated always as identity primary key,
  product_type_id bigint not null references public.catalog_product_types(id) on delete cascade,
  model_code text not null default '',
  size_code text not null check (length(btrim(size_code)) between 1 and 40),
  label text not null check (length(btrim(label)) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_type_id,model_code,size_code)
);

alter table public.catalog_product_sizes enable row level security;
grant select,insert,update,delete on public.catalog_product_sizes to authenticated;
grant usage,select on sequence public.catalog_product_sizes_id_seq to authenticated;
create policy catalog_product_sizes_admin on public.catalog_product_sizes
  for all to authenticated using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter table public.supplier_products
  add column catalog_product_size_id bigint references public.catalog_product_sizes(id) on delete restrict;
create index supplier_products_catalog_product_size_id_idx
  on public.supplier_products(catalog_product_size_id);

create temporary table droska_size_backfill (
  supplier_id bigint primary key,product_slug text,model_code text,
  size_code text,label text,sort_order integer
) on commit drop;

insert into pg_temp.droska_size_backfill
select s.id,
  case when c.slug in ('poleras','polera-mujer-basica','poleras-oversize','poleras-ninos') then 'poleras'
       when c.slug='bodys' then 'bodys' when c.slug='tote-bag' then 'totebags' end,
  case c.slug when 'poleras' then 'basic' when 'polera-mujer-basica' then 'woman'
       when 'poleras-oversize' then 'over' when 'poleras-ninos' then 'kid'
       when 'bodys' then 'body' when 'tote-bag' then 'tote' end,
  case when c.slug='poleras-ninos' then
         case when btrim(s.name) ~ '^[0-9]+[[:space:]]*años?$'
           then substring(btrim(s.name) from '^[0-9]+') || ' años' end
       when c.slug='bodys' then replace(s.slug,'-meses',' meses')
       when c.slug='tote-bag' then
         case when s.name ~* '(^|[[:space:]])mediana([[:space:]]|$)' then 'M'
              when s.name ~* '(^|[[:space:]])grande([[:space:]]|$)' then 'L' end
       else case lower(btrim(s.name))
         when 'extra pequeña' then 'XS' when 'extra pequena' then 'XS'
         when 'pequeña' then 'S' when 'pequena' then 'S'
         when 'mediana' then 'M' when 'grande' then 'L'
         when 'extra grande' then 'XL' when 'extragrande' then 'XL'
         when 'extra extra grande' then 'XXL' when 'extraextragrande' then 'XXL'
         when 'xxl' then 'XXL' when '2xl' then 'XXL' end end,
  s.name,s.sort_order
from public.supplier_products s
join public.supplier_categories c on c.id=s.category_id
where s.kind='garment' and c.slug in
  ('poleras','polera-mujer-basica','poleras-oversize','poleras-ninos','bodys','tote-bag');

do $$ begin
  if exists (select 1 from pg_temp.droska_size_backfill where size_code is null or product_slug is null)
  then raise exception 'Hay insumos comerciales sin talla reconocible; revisa el catálogo antes de migrar'; end if;
end $$;

insert into public.catalog_product_sizes (product_type_id,model_code,size_code,label,sort_order)
select product.id,m.model_code,m.size_code,min(m.size_code),min(m.sort_order)
from pg_temp.droska_size_backfill m
join public.catalog_product_types product on product.slug=m.product_slug
group by product.id,m.model_code,m.size_code;

alter table public.supplier_products disable trigger sync_sellable_clothing_variants_from_supplier;
alter table public.supplier_products disable trigger sync_body_variants_from_supplier;
update public.supplier_products s set catalog_product_size_id=size.id
from pg_temp.droska_size_backfill m
join public.catalog_product_types product on product.slug=m.product_slug
join public.catalog_product_sizes size on size.product_type_id=product.id
  and size.model_code=m.model_code and size.size_code=m.size_code
where s.id=m.supplier_id;
alter table public.supplier_products enable trigger sync_sellable_clothing_variants_from_supplier;
alter table public.supplier_products enable trigger sync_body_variants_from_supplier;

do $$ begin
  if exists (select 1 from pg_temp.droska_size_backfill m
             join public.supplier_products s on s.id=m.supplier_id
             where s.catalog_product_size_id is null)
  then raise exception 'La relación insumo → talla quedó incompleta'; end if;
end $$;

-- Una talla sin insumo publicado no puede permanecer a la venta. Actualmente
-- esto retira las dos variantes L de Tote Bag heredadas de datos de ejemplo.
update public.product_variants variant set active=false,updated_at=now()
where variant.active
  and exists (select 1 from public.product_models model
    where model.id=variant.product_model_id and model.code='tote')
  and not exists (
    select 1 from public.supplier_product_variants link
    join public.supplier_products supplier on supplier.id=link.supplier_product_id
    where link.product_variant_id=variant.id and supplier.active
      and supplier.confirmed_price_clp>0 and supplier.price_confirmed_at is not null
      and supplier.catalog_product_size_id is not null
  );

create or replace function public.validate_supplier_catalog_size()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare category_slug text; product_slug text; model text; expected_product text; expected_model text;
begin
  select slug into category_slug from public.supplier_categories where id=new.category_id;
  if new.kind<>'garment' or category_slug not in
    ('poleras','polera-mujer-basica','poleras-oversize','poleras-ninos','bodys','tote-bag')
  then return new; end if;
  if new.catalog_product_size_id is null then
    raise exception 'Selecciona una talla del producto para este insumo';
  end if;
  select product.slug,size.model_code into product_slug,model
  from public.catalog_product_sizes size
  join public.catalog_product_types product on product.id=size.product_type_id
  where size.id=new.catalog_product_size_id;
  expected_product:=case when category_slug in
    ('poleras','polera-mujer-basica','poleras-oversize','poleras-ninos') then 'poleras'
    when category_slug='bodys' then 'bodys' else 'totebags' end;
  expected_model:=case category_slug when 'poleras' then 'basic'
    when 'polera-mujer-basica' then 'woman' when 'poleras-oversize' then 'over'
    when 'poleras-ninos' then 'kid' when 'bodys' then 'body' else 'tote' end;
  if product_slug is distinct from expected_product or model is distinct from expected_model then
    raise exception 'La talla elegida no pertenece a este producto y modelo';
  end if;
  if tg_op='UPDATE' and old.catalog_product_size_id is distinct from new.catalog_product_size_id
    and old.confirmed_price_clp is not null then
    raise exception 'Un insumo con precio publicado no puede cambiar de talla; crea otro insumo';
  end if;
  if category_slug<>'tote-bag' and exists (
    select 1 from public.supplier_products other
    where other.category_id=new.category_id
      and other.catalog_product_size_id=new.catalog_product_size_id
      and other.id is distinct from new.id
  ) then raise exception 'Ya existe un insumo para esta talla y modelo'; end if;
  return new;
end;
$$;

create trigger validate_supplier_catalog_size_before_write
before insert or update of category_id,catalog_product_size_id,kind on public.supplier_products
for each row execute function public.validate_supplier_catalog_size();

create or replace function public.guard_catalog_size_code()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare product_slug text;
begin
  select slug into product_slug from public.catalog_product_types where id=new.product_type_id;
  if product_slug='poleras' and new.model_code not in ('basic','woman','over','kid')
    or product_slug='bodys' and new.model_code<>'body'
    or product_slug='totebags' and new.model_code<>'tote' then
    raise exception 'Este modelo no corresponde al producto';
  end if;
  if product_slug='poleras' and new.model_code='kid' and
      (new.size_code !~ '^[0-9]{1,2} años$' or substring(new.size_code from '^[0-9]+')::integer not between 1 and 18)
    or product_slug='poleras' and new.model_code<>'kid' and
      new.size_code !~ '^(XS|S|M|L|XL|XXL|[3-9]XL)$'
    or product_slug='bodys' and new.size_code !~ '^[0-9]{1,2}-[0-9]{1,2} meses$'
    or product_slug='totebags' and new.size_code not in ('M','L') then
    raise exception 'El código de talla no es válido para este producto y modelo';
  end if;
  if tg_op='UPDATE' then
    if old.size_code is distinct from new.size_code or old.model_code is distinct from new.model_code
      or old.product_type_id is distinct from new.product_type_id then
      if exists (select 1 from public.supplier_products where catalog_product_size_id=old.id) then
        raise exception 'No cambies la identidad de una talla vinculada; crea otra talla';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_catalog_size_code_before_write
before insert or update on public.catalog_product_sizes
for each row execute function public.guard_catalog_size_code();

create or replace function public.sync_sellable_clothing_variants()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare
  item public.supplier_products%rowtype;
  category_slug text; model_code text; model_id bigint; size_label text;
  sku_prefix text; sellable boolean;
begin
  item:=case when tg_op='DELETE' then old else new end;
  select slug into category_slug from public.supplier_categories where id=item.category_id;
  if category_slug not in ('poleras','polera-mujer-basica','poleras-oversize','poleras-ninos') then return null; end if;
  model_code:=case category_slug when 'poleras' then 'basic'
    when 'polera-mujer-basica' then 'woman' when 'poleras-oversize' then 'over' else 'kid' end;
  select size.size_code into size_label from public.catalog_product_sizes size
  where size.id=item.catalog_product_size_id and size.model_code=model_code;
  if size_label is null then raise exception 'El insumo % no tiene una talla configurada',item.id; end if;
  select id into model_id from public.product_models where code=model_code;
  if model_id is null then raise exception 'Falta el modelo comercial %',model_code; end if;
  sku_prefix:=case model_code when 'basic' then 'DR-BSC-' when 'woman' then 'DR-WMN-'
    when 'over' then 'DR-OVR-' else 'DR-KID-' end;
  sellable:=tg_op<>'DELETE' and item.active and item.confirmed_price_clp>0
    and item.price_confirmed_at is not null;
  if sellable then
    insert into public.product_variants
      (product_model_id,sku,size,color_name,color_hex,price_clp,personalization_base_price_clp,active)
    select distinct on (regexp_replace(template.sku,'^.*-','')) model_id,
      sku_prefix || (case when model_code='kid' then substring(size_label from '^[0-9]+')
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

create or replace function public.sync_body_variants_from_supplier()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare
  item public.supplier_products%rowtype;
  body_model_id bigint; size_label text; size_code text; sellable boolean;
begin
  item:=case when tg_op='DELETE' then old else new end;
  if not exists (select 1 from public.supplier_categories where id=item.category_id and slug='bodys')
  then return null; end if;
  select size.size_code into size_label from public.catalog_product_sizes size
  where size.id=item.catalog_product_size_id and size.model_code='body';
  if size_label is null then raise exception 'El insumo % no tiene una talla de Body',item.id; end if;
  size_code:=regexp_replace(size_label,'[^0-9]','','g');
  select id into body_model_id from public.product_models where code='body';
  if body_model_id is null then raise exception 'Falta el modelo comercial body'; end if;
  sellable:=tg_op<>'DELETE' and item.active and item.confirmed_price_clp>0
    and item.price_confirmed_at is not null;
  if sellable then
    insert into public.product_variants
      (product_model_id,sku,size,color_name,color_hex,price_clp,personalization_base_price_clp,active)
    select body_model_id,'DR-BDY-'||size_code||'-'||color.sku_suffix,
      size_label,color.name,upper(color.hex),item.confirmed_price_clp,
      item.personalization_base_price_clp,true
    from public.product_color_availability availability
    join public.catalog_colors color on color.code=availability.color_code and color.active
    where availability.product_slug='bodys' and availability.active
    on conflict (sku) do update set size=excluded.size,color_name=excluded.color_name,
      color_hex=excluded.color_hex,price_clp=excluded.price_clp,
      personalization_base_price_clp=excluded.personalization_base_price_clp,
      active=true,updated_at=now();
    update public.product_variants variant set
      active=exists (select 1 from public.product_color_availability availability
        join public.catalog_colors color on color.code=availability.color_code
        where availability.product_slug='bodys' and availability.active
          and color.hex=lower(variant.color_hex)),updated_at=now()
    where variant.product_model_id=body_model_id and variant.size=size_label;
    insert into public.supplier_product_variants (supplier_product_id,product_variant_id)
    select item.id,variant.id from public.product_variants variant
    where variant.product_model_id=body_model_id and variant.size=size_label and variant.active
    on conflict do nothing;
  else
    update public.product_variants set active=false,updated_at=now()
    where product_model_id=body_model_id and size=size_label;
  end if;
  insert into public.catalog_product_types
    (slug,name,menu_description,active,sort_order)
  values ('bodys','Bodys','Diseños para los más pequeños',
    exists (select 1 from public.product_variants variant
      where variant.product_model_id=body_model_id and variant.active),15)
  on conflict (slug) do update set active=excluded.active,updated_at=now();
  return null;
end;
$$;

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
    select size.size_code into tote_size from public.catalog_product_sizes size
    where size.id = item.catalog_product_size_id and size.model_code = 'tote';
    tote_color_code := case
      when item.name ~* '(^|[[:space:]])negr[ao]([[:space:]]|$)' then 'black'
      when item.name ~* '(^|[[:space:]])(crud[ao]|beige|natural)([[:space:]]|$)' then 'beige'
    end;

    if tote_size is null or tote_color_code is null then
      raise exception 'La Tote Bag requiere una talla y color configurados';
    end if;
    if tote_size is not null and tote_color_code is not null then
      select count(*), min(variant.id)
      into tote_variant_count, tote_variant_id
      from public.product_variants as variant
      join public.product_models as model on model.id = variant.product_model_id
      join public.catalog_colors as color on lower(variant.color_hex) = color.hex
      where model.code = 'tote' and model.active
        and variant.size = tote_size
        and color.code = tote_color_code and color.active;

      if tote_variant_count <> 1 then
        raise exception 'No hay una variante única y activa de Tote Bag para este color y talla';
      end if;

      update public.product_variants set active=true,updated_at=now()
      where id=tote_variant_id;

      delete from public.supplier_product_variants as link
      using public.supplier_products as other
      where link.supplier_product_id = other.id
        and other.category_id = item.category_id
        and other.id <> item.id
        and link.product_variant_id = tote_variant_id;

      delete from public.supplier_product_variants as own_link
      where own_link.supplier_product_id = item.id
        and own_link.product_variant_id <> tote_variant_id;

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
  'Publica el precio y usa la talla configurada en Productos para vincular la variante exacta de Tote Bag.';
