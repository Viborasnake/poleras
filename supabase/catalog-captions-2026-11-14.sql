-- Textos cortos del catálogo. Cada descripción comienza con un emoji y
-- permanece dentro del límite de 180 caracteres del formulario de Administración.
update public.catalog_designs as design
set caption = copy.caption
from (values
  ('carpintero-negro-espiritu-del-bosque', '🪵 El carpintero negro cobra fuerza entre árboles y trazos de inspiración ukiyo-e: un homenaje al bosque austral.'),
  ('chincol-alma-del-barrio', '🐦 El chincol de plazas y jardines, retratado con aire ukiyo-e para llevar un pedacito del barrio a todas partes.'),
  ('choroy-voz-del-bosque', '🦜 El verde intenso y la voz inconfundible del choroy inspiran esta pieza de espíritu sureño y estética japonesa.'),
  ('golondrina-chilena-libertad-en-vuelo', '🕊️ Una golondrina chilena en pleno vuelo: líneas ágiles y aire ukiyo-e para quienes llevan la libertad por dentro.'),
  ('hued-hued-el-guardian-del-bosque', '🌿 Desde el sotobosque austral aparece el hued-hued: esquivo, de canto profundo y lleno de misterio.'),
  ('loica-corazon-escarlata', '❤️ El pecho rojo de la loica se vuelve protagonista de una ilustración con carácter y guiños al ukiyo-e.'),
  ('mirlo-negro-sombra-urbana', '🌑 El mirlo transforma su silueta oscura y sus reflejos brillantes en una pieza urbana de inspiración japonesa.'),
  ('paloma-habitante-de-la-ciudad', '🏙️ La paloma de plazas y calles se gana otra mirada en esta ilustración de inspiración ukiyo-e.'),
  ('queltehue-guardian-del-paisaje', '👀 Siempre alerta, el queltehue vigila el humedal en una pieza que celebra su presencia inconfundible.'),
  ('siete-colores-el-ave-que-inspiro-a-fiu', '🌈 El siete colores, pequeño habitante de los humedales e inspiración de Fiu, brilla en esta pieza llena de vida.'),
  ('tenca-canto-de-la-zona-central', '🎶 La tenca y su talento para imitar otros cantos protagonizan este homenaje al paisaje sonoro de Chile central.'),
  ('torcaza-espiritu-del-sur', '🪶 La torcaza nativa aporta su presencia serena a una ilustración de inspiración japonesa.'),
  ('turca-espiritu-de-la-cordillera', '⛰️ La turca de laderas rocosas inspira una pieza expresiva, con alma de cordillera y trazos ukiyo-e.'),
  ('zorzal-melodia-del-jardin-polera', '🎵 El canto del zorzal lleva la calma del jardín a una ilustración con aire ukiyo-e.'),
  ('zalo-reyes', '🎤 La voz del Gorrión de Conchalí y sus canciones de desamor viven en este homenaje a Zalo Reyes.'),
  ('marie-curie', '⚛️ Un homenaje a Marie Curie, pionera de la radiactividad y primera persona en recibir dos premios Nobel.'),
  ('ola-kanagawa', '🌊 La gran ola de Hokusai convierte el movimiento del mar en una imagen imposible de olvidar.'),
  ('duro-de-matar', '💥 Pon las caras de tu familia o amigos en una aventura de acción navideña con espíritu de cine ochentero.'),
  ('mentiras-verdaderas', '🎬 Tu gente protagoniza una aventura de acción noventera: envíanos sus fotos y hacemos el afiche a su pinta.'),
  ('mi-pobre-angelito', '🏠 Esta Navidad, tu familia o tus amigos toman el lugar de Kevin y los ladrones en un afiche hecho con sus fotos.'),
  ('navidad-el-grinch', '🎄 ¿Quién es el Grinch de la familia? Envíanos sus fotos y conviértelo en protagonista de un diseño navideño.'),
  ('regalo-prometido', '🎁 El próximo Turbo Man puede ser alguien de tu familia: personaliza este clásico navideño con sus fotos.'),
  ('dio-brando', '🦇 El carisma oscuro y la ambición de Dio Brando llegan a una pieza para fans de JoJo’s Bizarre Adventure.'),
  ('elfen-lied', '🩸 Inocencia y oscuridad se cruzan en esta pieza inspirada en el universo inquietante de Elfen Lied.'),
  ('guardiana-celestial-megntica', '🌙 Una guardiana de inspiración Sailor Moon entre estrellas, tinta retro y destellos magenta.'),
  ('guerrera-del-fuego', '🔥 Sailor Mars se roba la escena: fuego, actitud y estética de anime retro en una pieza llena de energía.'),
  ('bebe-en-espiral-psicodelica', '🌀 Un bebé en medio de una espiral psicodélica: color, humor y nostalgia de los videojuegos retro.'),
  ('claire-redfield-racoon-city-comisaria', '🧟 Claire Redfield se enfrenta al horror de la comisaría de Raccoon City en una pieza para fans de Resident Evil.'),
  ('cliff-unger', '🖤 Cliff Unger y su búsqueda de BB inspiran una pieza oscura y cinematográfica del universo Death Stranding.'),
  ('jill-valentine-comisaria-racoon-city', '🚨 Jill Valentine entra en la comisaría de Raccoon City: tensión y nostalgia para fans de Resident Evil.'),
  ('meryl-cyberpunk', '⚡ Meryl en clave cyberpunk: luces futuristas y un guiño a las misiones de Metal Gear Solid.'),
  ('sam-bajo-la-luna-magenta', '🌌 Sam camina bajo una luna magenta en una escena de ciencia ficción, con aire japonés y ganas de explorar.'),
  ('solid-snake-shadow-moses', '📦 Solid Snake vuelve a Shadow Moses en una pieza cargada de sigilo y nostalgia de Metal Gear Solid.'),
  ('laika-viajera-espacial', '🚀 Laika mira hacia las estrellas en un homenaje retroespacial a la primera perrita que orbitó la Tierra.'),
  ('la-playera', '🏖️ Tu mascota disfruta de un día de playa: envíanos su foto y la convertimos en protagonista de esta escena.'),
  ('mascota-waves', '🐾 Tu perro o gato protagoniza una ilustración de inspiración japonesa con toda su personalidad.'),
  ('terror-de-la-ciudad', '🐕 Tu mascota se convierte en el monstruo más adorable de la ciudad. Envíanos su foto para crear la escena.'),
  ('salvate-solo', '🐕 Un perro frente al caos y las promesas políticas: sátira chilena con humor negro y espíritu de supervivencia.'),
  ('vamos-a-vencer', '⚔️ Lula en modo Jedi protagoniza una sátira política galáctica sobre poder y resistencia.'),
  ('you-are-fired', '🧢 Una frase tajante en clave pixel art: ironía y actitud para quienes disfrutan la sátira política.')
) as copy(slug, caption)
where design.slug = copy.slug
  and design.caption is distinct from copy.caption;
