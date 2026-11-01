-- Catálogo maestro y disponibilidad masiva de colores por familia vendible.
-- Las familias sin color (afiches, imanes, vasos térmicos, etc.) quedan fuera.

create table if not exists public.catalog_colors (
  code text primary key,
  name text not null,
  hex text not null unique,
  group_name text not null,
  shade text not null,
  sku_suffix text not null unique,
  sort_order integer not null,
  active boolean not null default true,
  constraint catalog_colors_code_format check (code ~ '^[a-z0-9_]+$'),
  constraint catalog_colors_hex_format check (hex ~ '^#[0-9a-f]{6}$')
);

insert into public.catalog_colors (code,name,hex,group_name,shade,sku_suffix,sort_order) values
  ('white','Blanco','#ffffff','neutral','Claro','WHT',10),
  ('natural','Natural','#e8e0cf','neutral','Claro','NAT',20),
  ('gray','Gris','#85878a','neutral','Normal','GRY',30),
  ('black','Negro','#202124','neutral','Oscuro','BLK',40),
  ('sky','Celeste','#9bd7f0','blue','Claro','SKY',50),
  ('royal_blue','Azul rey','#2b50a2','blue','Normal','ROY',60),
  ('navy','Azul marino','#1d3557','blue','Oscuro','NVY',70),
  ('dark_blue','Azul oscuro','#17243d','blue','Oscuro','DBL',80),
  ('mint','Verde menta','#b7e4c7','green','Claro','MNT',90),
  ('green','Verde','#3f8f5f','green','Normal','GRN',100),
  ('bottle_green','Verde botella','#1f5132','green','Oscuro','BTL',110),
  ('olive','Verde olivo','#707a3c','green','Normal','OLV',120),
  ('military','Verde militar','#4b5320','green','Oscuro','MIL',130),
  ('dark_green','Verde oscuro','#24452f','green','Oscuro','DGN',140),
  ('lavender','Lavanda','#c8b6e2','purple','Claro','LAV',150),
  ('purple','Morado','#7046a3','purple','Normal','PUR',160),
  ('dark_purple','Morado oscuro','#3f275a','purple','Oscuro','DPR',170),
  ('pink','Rosado','#e89ab7','red','Claro','PNK',180),
  ('red','Rojo','#c73532','red','Normal','RED',190),
  ('dark_red','Rojo oscuro','#7e2728','red','Oscuro','DRD',200),
  ('yellow','Amarillo','#f4d35e','warm','Claro','YLW',210),
  ('mustard','Mostaza','#c79a2b','warm','Normal','MST',220),
  ('orange','Naranjo','#d86b2a','warm','Oscuro','ORG',230),
  ('beige','Beige','#d9c7a4','brown','Claro','BGE',240),
  ('coffee','Café','#755139','brown','Normal','CAF',250),
  ('dark_coffee','Café oscuro','#4a2c25','brown','Oscuro','DCF',260)
on conflict (code) do update set
  name=excluded.name,hex=excluded.hex,group_name=excluded.group_name,shade=excluded.shade,
  sku_suffix=excluded.sku_suffix,sort_order=excluded.sort_order,active=true;

create table if not exists public.product_color_availability (
  product_slug text not null references public.catalog_product_types(slug) on update cascade on delete cascade,
  color_code text not null references public.catalog_colors(code) on update cascade on delete restrict,
  active boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (product_slug,color_code),
  constraint product_color_availability_supported_product check (product_slug in ('poleras','bodys','totebags'))
);
create index if not exists product_color_availability_color_code_idx
  on public.product_color_availability(color_code);

insert into public.product_color_availability (product_slug,color_code,active)
select product.slug,color.code,
  case product.slug
    when 'poleras' then color.code in ('white','black','beige','dark_blue','dark_green','dark_coffee','red')
    when 'bodys' then color.code in ('white','black','dark_blue','dark_coffee','red')
    when 'totebags' then color.code = 'beige'
  end
from public.catalog_product_types as product
cross join public.catalog_colors as color
where product.slug in ('poleras','bodys','totebags')
on conflict (product_slug,color_code) do update
set active=excluded.active,updated_at=now();

alter table public.catalog_colors enable row level security;
alter table public.product_color_availability enable row level security;
revoke all on public.catalog_colors from anon,authenticated;
revoke all on public.product_color_availability from anon,authenticated;
grant select on public.catalog_colors to anon,authenticated;
grant select,update on public.product_color_availability to authenticated;
drop policy if exists "catalog_colors_read" on public.catalog_colors;
create policy "catalog_colors_read" on public.catalog_colors for select to anon,authenticated using (active);
drop policy if exists "admin_product_color_availability_read" on public.product_color_availability;
create policy "admin_product_color_availability_read" on public.product_color_availability
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "admin_product_color_availability_manage" on public.product_color_availability;
create policy "admin_product_color_availability_manage" on public.product_color_availability
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

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

revoke all on function private.sync_product_color_variants(text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.sync_product_color_variants(text) to authenticated;

create or replace function public.set_product_color_availability(_availability jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  requested_product_slug text;
  codes jsonb;
begin
  if not (select public.is_admin()) then raise exception 'No autorizado.' using errcode='42501'; end if;
  if jsonb_typeof(_availability)<>'object' then raise exception 'La disponibilidad no es válida.'; end if;

  for requested_product_slug,codes in select key,value from jsonb_each(_availability) loop
    if requested_product_slug not in ('poleras','bodys','totebags') or jsonb_typeof(codes)<>'array' or jsonb_array_length(codes)=0 then
      raise exception 'Selecciona al menos un color para cada producto.';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(codes) as requested(code)
      left join public.catalog_colors as color on color.code=requested.code and color.active
      where color.code is null
    ) then raise exception 'La selección contiene un color desconocido.'; end if;

    update public.product_color_availability set active=false,updated_at=now() where product_slug=requested_product_slug;
    update public.product_color_availability as availability
    set active=true,updated_at=now()
    where availability.product_slug=requested_product_slug
      and availability.color_code in (select jsonb_array_elements_text(codes));
    perform private.sync_product_color_variants(requested_product_slug);
  end loop;
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.set_product_color_availability(jsonb) from public,anon;
grant execute on function public.set_product_color_availability(jsonb) to authenticated;

-- La publicación futura de tallas de body respeta la paleta configurada,
-- en lugar de volver a crear una lista fija de colores.
create or replace function public.sync_body_variants_from_supplier()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  item public.supplier_products%rowtype;
  body_model_id bigint;
  size_label text;
  size_code text;
  sellable boolean;
begin
  item:=case when TG_OP='DELETE' then OLD else NEW end;
  if not exists (select 1 from public.supplier_categories where id=item.category_id and slug='bodys') then return null; end if;
  size_label:=case item.slug when '0-3-meses' then '0-3 meses' when '3-6-meses' then '3-6 meses' when '6-12-meses' then '6-12 meses' when '12-24-meses' then '12-24 meses' end;
  size_code:=case item.slug when '0-3-meses' then '03' when '3-6-meses' then '36' when '6-12-meses' then '612' when '12-24-meses' then '1224' end;
  if size_label is null then return null; end if;
  select id into body_model_id from public.product_models where code='body';
  if body_model_id is null then raise exception 'Falta el modelo comercial body'; end if;
  sellable:=TG_OP<>'DELETE' and item.active and item.confirmed_price_clp>0 and item.price_confirmed_at is not null;
  if sellable then
    insert into public.product_variants (product_model_id,sku,size,color_name,color_hex,price_clp,active)
    select body_model_id,'DR-BDY-'||size_code||'-'||color.sku_suffix,size_label,color.name,upper(color.hex),item.confirmed_price_clp,true
    from public.product_color_availability as availability
    join public.catalog_colors as color on color.code=availability.color_code and color.active
    where availability.product_slug='bodys' and availability.active
    on conflict (sku) do update set size=excluded.size,color_name=excluded.color_name,color_hex=excluded.color_hex,price_clp=excluded.price_clp,active=true,updated_at=now();
    update public.product_variants as variant set active=exists (
      select 1 from public.product_color_availability as availability
      join public.catalog_colors as color on color.code=availability.color_code
      where availability.product_slug='bodys' and availability.active and color.hex=lower(variant.color_hex)
    ),updated_at=now()
    where variant.product_model_id=body_model_id and variant.size=size_label;
    insert into public.supplier_product_variants (supplier_product_id,product_variant_id)
    select item.id,variant.id from public.product_variants as variant
    where variant.product_model_id=body_model_id and variant.size=size_label and variant.active
    on conflict do nothing;
  else
    update public.product_variants set active=false,updated_at=now() where product_model_id=body_model_id and size=size_label;
  end if;
  return null;
end;
$$;

select private.sync_product_color_variants('poleras');
select private.sync_product_color_variants('bodys');
select private.sync_product_color_variants('totebags');
