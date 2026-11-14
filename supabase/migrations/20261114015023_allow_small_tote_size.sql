-- Permite S (Pequeña) en Productos → Tallas para Tote Bag.
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
    or product_slug='totebags' and new.size_code not in ('S','M','L') then
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


