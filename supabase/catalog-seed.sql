-- Catálogo inicial de Droska. Es idempotente y conserva cualquier colección
-- o diseño que ya haya creado el equipo desde el panel.

insert into public.catalog_collections (product_type_id, slug, name, active, sort_order)
select product.id, seed.slug, seed.name, true, seed.sort_order
from (values
  ('papa', 'Para Papá', 10),
  ('mama', 'Para Mamá', 20),
  ('bebe', 'Para el bebé', 30),
  ('juegos', 'Juegos', 40),
  ('peliculas', 'Películas', 50)
) as seed(slug, name, sort_order)
join public.catalog_product_types product on product.slug = 'poleras'
on conflict (slug) do nothing;

insert into public.catalog_designs (collection_id, slug, name, caption, artwork_path, active)
select collection.id, design.slug, design.name, design.caption, 'local:' || design.slug, true
from (values
  ('papa', 'papa-leyenda', 'Modo leyenda', 'Para el papá que siempre está.'),
  ('papa', 'papa-ruta', 'Nuestra ruta', 'Todas las aventuras empiezan juntos.'),
  ('mama', 'mama-lugar', 'Mi lugar favorito', 'Un abrazo para llevar puesto.'),
  ('mama', 'mama-universo', 'Mi universo', 'Para quien ilumina todo.'),
  ('bebe', 'bebe-hola', 'Hola, mundo', 'Una bienvenida llena de cariño.'),
  ('bebe', 'bebe-amor', 'Pequeño gran amor', 'Para celebrar a quien llegó a cambiarlo todo.'),
  ('juegos', 'juegos-player', 'Player one', 'Para quien nunca suelta el control.'),
  ('juegos', 'juegos-pausa', 'Pausa breve', 'Una partida más y vamos.'),
  ('peliculas', 'peliculas-escena', 'Nuestra escena', 'Para historias que quieres repetir.'),
  ('peliculas', 'peliculas-creditos', 'Aún no termina', 'Todavía quedan escenas por vivir.')
) as design(collection_slug, slug, name, caption)
join public.catalog_collections collection on collection.slug = design.collection_slug
on conflict (slug) do nothing;
