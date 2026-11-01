-- A design has an explicitly uploaded artwork for every supported product.
-- Existing artwork is assigned only to its collection's original product.
alter table public.catalog_designs add column product_artworks jsonb;
update public.catalog_designs d
set product_artworks = jsonb_build_object(p.slug, d.artwork_path)
from public.catalog_collections c join public.catalog_product_types p on p.id = c.product_type_id
where c.id = d.collection_id;

create or replace function public.validate_catalog_product_artworks()
returns trigger language plpgsql set search_path = public as $$
declare product_slug text; artwork jsonb; collection_product text;
begin
  select p.slug into collection_product from public.catalog_collections c
  join public.catalog_product_types p on p.id=c.product_type_id where c.id=new.collection_id;
  -- Compatibility for existing importers: never infer support for other products.
  if new.product_artworks is null then
    new.product_artworks := jsonb_build_object(collection_product,new.artwork_path);
  end if;
  if jsonb_typeof(new.product_artworks) <> 'object' or new.product_artworks = '{}'::jsonb then
    raise exception 'Selecciona al menos un producto y carga su archivo.';
  end if;
  for product_slug, artwork in select key,value from jsonb_each(new.product_artworks) loop
    if not exists(select 1 from public.catalog_product_types where slug=product_slug) then
      raise exception 'El producto % no existe.',product_slug;
    end if;
    if jsonb_typeof(artwork) <> 'string' or btrim(artwork #>> '{}') = ''
       or (artwork #>> '{}') !~ '^(https://|local:)' then
      raise exception 'Falta un archivo válido para %.',product_slug;
    end if;
  end loop;
  new.artwork_path := coalesce(new.product_artworks->>collection_product,
    (select value from jsonb_each_text(new.product_artworks) order by key limit 1));
  return new;
end $$;
create trigger catalog_product_artworks_validation
before insert or update on public.catalog_designs
for each row execute function public.validate_catalog_product_artworks();
alter table public.catalog_designs alter column product_artworks set not null;
revoke all on function public.validate_catalog_product_artworks() from public;

-- Orders retain the exact product-specific production file used at purchase.
alter table public.order_items add column catalog_artwork_path text;
comment on column public.order_items.catalog_artwork_path is 'Immutable public catalog artwork URL selected for the purchased product.';
;
