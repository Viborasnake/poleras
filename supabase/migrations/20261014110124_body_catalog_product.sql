-- I04: reserva la familia pública sin publicar una prenda sin variantes,
-- precios confirmados ni visor propio. El slug comercial es `bodys`.
insert into public.catalog_product_types (slug, name, menu_description, active, sort_order)
values ('bodys', 'Bodys', 'Diseños para los más pequeños', false, 15)
on conflict (slug) do nothing;
