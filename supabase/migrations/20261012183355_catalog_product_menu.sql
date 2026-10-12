-- El menú público comparte productos y descripciones con Administración.
alter table public.catalog_product_types
  add column if not exists menu_description text;

insert into public.catalog_product_types (slug,name,menu_description,active,sort_order) values
  ('totebags','Totebags','Tu idea para llevar',true,40),
  ('vasos-termicos','Vasos térmicos','Para acompañarte todo el día',true,50)
on conflict (slug) do nothing;

update public.catalog_product_types
set menu_description = case slug
  when 'poleras' then 'Diseños listos y personalizados'
  when 'imanes' then 'Para pegar tus mejores ideas'
  when 'afiches' then 'Arte para tus espacios'
  when 'totebags' then 'Tu idea para llevar'
  when 'vasos-termicos' then 'Para acompañarte todo el día'
end
where slug in ('poleras','imanes','afiches','totebags','vasos-termicos')
  and nullif(trim(menu_description),'') is null;
