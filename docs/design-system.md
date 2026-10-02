# Design system de Droska

Referencia para diseñar interfaces de Droska. Este documento describe las reglas; [`design-system.html`](../design-system.html) muestra los especímenes interactivos. Los valores implementados viven en [`src/design-system.css`](../src/design-system.css). Si una muestra y el código difieren, hay que corregir la discrepancia antes de dar por aprobado un cambio.

## 1. Cómo usar este sistema

1. Elige el **rol** que necesita el contenido (texto, superficie, acción, estado), no un hexadecimal por gusto.
2. Para colocar texto, íconos o bordes sobre una superficie, usa un **par oficial** de la sección siguiente. Es una lista cerrada para producto.
3. El explorador de contraste calcula posibilidades técnicas desde los tokens activos. Sus celdas `AA` o `UI` **no** autorizan un nuevo par corporativo.
4. Reutiliza el componente o patrón existente. Documenta estados, tamaños y comportamiento responsive al añadir una variante.
5. Comprueba contraste, foco, teclado y lectura en tamaños pequeños antes de incorporar la variante al catálogo.

## 2. Color

### Jerarquía y roles

| Grupo | Token de referencia | Valor | Uso |
| --- | --- | --- | --- |
| Primario | Ink 900 | `#262920` | Texto principal y acción principal |
| Primario | Pink 500 | `#F957A4` | Acento de marca; la sombra del CTA tiene su propio token |
| Secundario | Lilac 500 | `#6652C5` | Bloque expresivo y foco |
| Secundario | Lime 500 | `#DFFF78` | Selección y énfasis |
| Semántico | Success | `#2F6B2F` | Confirmación |
| Semántico | Warning | `#9A4D00` | Atención |
| Semántico | Danger | `#B42318` | Error |
| Semántico | Info | `#275DAB` | Información |

Los colores semánticos no dependen del color como única señal: acompañarlos con texto, etiqueta o ícono. Las escalas **Neutral, Pink, Lime y Lilac** están en el catálogo; sus pasos sirven para construir tokens, no para elegir colores directamente en cada componente.

Los componentes consumen variables semánticas como `--ds-brand-primary`, `--ds-surface-page`, `--ds-text-primary`, `--ds-action-primary`, `--ds-border-control`, `--ds-focus-ring` y `--ds-feedback-danger`. Las escalas (`--ds-neutral-*`, `--ds-pink-*`, etc.) son la capa base. Evita introducir hexadecimales nuevos en un componente cuando ya exista un rol adecuado.

### Pares oficiales aprobados

Cada fila define **contenido / superficie / contexto**. Los ratios siguientes son los documentados en el catálogo; recalcúlalos si cambia un token.

| Grupo | Par | Uso autorizado | Contraste |
| --- | --- | --- | --- |
| Base y lectura | `text-primary / page` | Títulos y contenido general | 13.8:1 AA |
| Base y lectura | `text-primary / raised` | Tarjetas y modales | 14.6:1 AA |
| Base y lectura | `text-primary / subtle` | Paneles suaves | 13.4:1 AA |
| Base y lectura | `text-secondary / page` | Apoyo y descripción | 7.1:1 AA |
| Base y lectura | `link / page` | Navegación textual | 8.1:1 AA |
| Marca y acción | `inverse / brand-primary` | CTA principal Ink | 14.8:1 AA |
| Marca y acción | `text-primary / brand-accent` | Etiquetas y énfasis Pink | 4.9:1 AA |
| Marca y acción | `inverse / brand-secondary` | Bloque Lilac | 5.9:1 AA |
| Marca y acción | `text-primary / lime` | Opción seleccionada | 13.2:1 AA |
| Interacción y estado | `focus-ring / page` | Anillo de foco | 5.5:1 UI |
| Interacción y estado | `border-control / raised` | Bordes de controles | 4.8:1 UI |
| Interacción y estado | `text-disabled / disabled` | Estado no disponible | 5.9:1 AA |
| Feedback | `inverse / success` | Confirmación | 6.4:1 AA |
| Feedback | `inverse / warning` | Advertencia | 6.1:1 AA |
| Feedback | `inverse / danger` | Error crítico | 6.6:1 AA |
| Feedback | `inverse / info` | Mensaje informativo | 6.5:1 AA |

Fuera de esta lista, un par requiere revisión y aprobación de diseño aunque cumpla contraste. El explorador se actualiza automáticamente a partir de CSS; esta lista normativa se mantiene de forma deliberada.

### Criterio de contraste

- WCAG 2.0 AA: texto normal ≥ **4.5:1**; texto grande ≥ **3:1** (al menos 24 px regular o aproximadamente 18.7 px en negrita).
- El DS adopta además ≥ **3:1** como criterio interno para bordes de controles e íconos significativos. No se presenta ese criterio interno como un requisito textual de WCAG 2.0.
- La etiqueta `UI` del explorador indica que el ratio llega a 3:1 pero no necesariamente a 4.5:1. No usarla para texto normal.
- Los estados `disabled` pueden necesitar tratamiento específico: no comunicar información crítica solo con una apariencia deshabilitada.

## 3. Tipografía

| Voz | Familia | Uso | Pesos documentados |
| --- | --- | --- | --- |
| Principal | Space Grotesk | Display, titulares, cifras y nombres de producto | 500, 600, 700 |
| Funcional | DM Sans | Navegación, lectura, formularios y botones | 400, 500, 600, 700 |
| Complementaria | Caveat | Frases breves y notas editoriales | 500, 600, 700 |

Caveat no se usa en controles, precios, errores o contenido esencial. En el DS se reserva para 24 px o más. Si falla una webfont, se usan las cadenas de respaldo definidas por `--ds-font-display`, `--ds-font-body` y `--ds-font-accent`.

La escala de escritorio se documenta en el catálogo: `display-xl` 72/68, `heading-1` 52/52, `heading-2` 38/40, `heading-3` 26/30, `body-lg` 18/28, `body-md` 15/24, `label` 12/16, `eyebrow` 10/15 y `accent` 32/34 (px de tamaño/interlínea). Los títulos se adaptan con `clamp()` en pantallas pequeñas; el texto de lectura no debe bajar de 14 px. `label` y `eyebrow` son usos breves y de alta jerarquía visual, no sustitutos del cuerpo de texto.

## 4. Componentes y estados

- **CTA principal (`.ds-cta`)**: Ink con texto inverso y sombra Pink. Un primario por contexto. Variantes con y sin flecha, tamaños S (44 px), M (54 px), L (62 px). La flecha nunca sustituye el texto.
- **Acción secundaria (`.ds-cta-ghost`, `.ds-secondary-button`)**: acompaña a la principal sin competir. Variante con o sin ícono.
- **Acción contextual (`.ds-guide-button`)**: acceso compacto, por ejemplo guía de tallas.
- **Controles de ícono (`.ds-icon-button`, `.ds-cart-button`)**: nombre accesible obligatorio; el contador del carro acompaña al ícono.
- **Selección (`.ds-choice-button`, `.ds-swatch-button`)**: estado seleccionado visible con borde/anillo, no solo con color.
- **Cantidad (`.ds-quantity`)**: botones de aumentar y reducir con etiqueta accesible.
- **Campo (`.ds-field`)**: etiqueta, ayuda y validación. Se muestran reposo, foco, completo, error, éxito, disabled y solo lectura.
- **Alertas transitorias**: comunican éxito, información o error en español con ícono, texto explícito y contraste semántico. Los errores de autenticación traducen el mensaje técnico a una acción comprensible para la persona.
- **Otros controles**: radio, checkbox, búsqueda, filtro, rango y carga por selección o arrastre tienen especímenes en Forms. Búsqueda, filtro y rango actualizan su feedback en el catálogo.

Los controles documentan reposo, hover, activo, foco y disabled cuando corresponde; los selectores añaden selected y los enlaces pueden mostrar visited. El foco debe permanecer visible al navegar con teclado. Las muestras estáticas de estados no equivalen a controles de producción completamente conectados.

## 5. Patrones de contenido

- **Encabezado de sección**: eyebrow opcional, título obligatorio, texto de apoyo opcional y divisor contextual. Se muestran versiones editorial, compacta y móvil apilada.
- **Header del estudio**: marca y cierre persistentes; el contexto se muestra completo, abreviado o en segunda línea según el espacio.
- **Navegación de productos**: el header agrupa las familias bajo “Productos”. El disparador conserva el mismo tamaño, peso y línea base que los enlaces vecinos y señala el estado abierto con un subrayado Pink. El menú se ancla y centra bajo el disparador; la familia disponible usa una fila destacada con descripción y acción, mientras las familias futuras se mantienen como filas livianas no interactivas con descripción y etiqueta “Próximamente”. El desplegable opera con `details/summary`, conserva foco visible y se cierra al elegir una opción o pulsar fuera. En móvil ocupa el ancho útil sin caret flotante.
- **Hero rotativo**: alterna automáticamente entre los dos caminos principales cada seis segundos. Sus controles numerados permiten seleccionar una vista, se pausa al posar el cursor o mover el foco dentro del bloque y ofrece un control explícito para pausar o reanudar. Con `prefers-reduced-motion` no rota automáticamente.
- **Progreso del estudio**: tres pasos (Detalles, Resumen, Datos y pago), con paso actual identificable por texto además del estilo. En una personalización propia, Detalles reúne modelo, color, talla, carga del archivo y ubicación del estampado, incluyendo las caras necesarias. Al terminar de cargar un archivo, el mockup 3D se actualiza en ese mismo paso. Si requiere revisión técnica, se comunica allí y se desglosa en el resumen sin añadir una pantalla intermedia. Contacto, despacho o retiro y acceso opcional a cuenta aparecen juntos al final, inmediatamente antes de confirmar.
- **Tarjeta de camino creativo**: desde 1440 px, arte y tres pasos horizontales comparten dos columnas. Entre 1000 y 1439 px, la polera ocupa la columna derecha y los tres pasos se leen verticalmente, junto al título y al CTA en la izquierda. Entre 761 y 999 px, el arte tiene una franja propia y los pasos conservan el ancho completo en una fila. En móvil, el proceso se apila y el CTA conserva el ancho útil. No comprimas tres pasos horizontales dentro de una columna estrecha.
- **Catálogo de prediseñadas**: la vista inicial muestra una portada por colección; cada portada tiene una polera 3D, nombre, acción para abrirla y una pill blanca con ícono de polera y cantidad de diseños activos calculada desde el contenido real de esa colección, nunca escrita manualmente. Cada diseño guarda además un color de polera de muestra —elegido explícitamente en el panel con nombre, swatch y estado seleccionado visible— que se reutiliza en su portada 3D y al abrirlo en el estudio; el color nunca se comunica como única señal. La etiqueta respeta singular y plural. En el mockup 3D, `100%` representa el área segura máxima, no el lienzo bruto del archivo: el visor descarta el margen transparente para calcular la proporción visible y reduce automáticamente las piezas verticales para mantenerlas centradas sobre el pecho. El análisis preserva píxeles semitransparentes y deja un margen de seguridad para no cortar esquinas, tramas o salpicaduras del diseño. Las portadas de colección son más altas para mostrar la polera completa a un tamaño útil; el encuadre inicial privilegia la prenda y el estampado sin cortar cuello ni basta. Las portadas alternan fondos Pink, Lilac, Lime y mixtos según su posición para distinguir colecciones sin alterar su contenido. En dispositivos con hover, la prenda se acerca aún más hasta privilegiar el área del estampado, aunque cuello y basta queden parcialmente fuera del marco; el contenedor y los controles permanecen inmóviles, el foco de teclado activa la misma señal y `prefers-reduced-motion` elimina la transición. Formas orgánicas translúcidas y tres trazos Pink decoran el fondo detrás de la prenda; son elementos no informativos y no interfieren con texto ni controles. Al abrir una colección, sus diseños aparecen en un diálogo modal y las portadas permanecen en su lugar detrás; el diálogo tiene título, contador, cierre visible y también se cierra al pulsar el fondo. Las tarjetas de diseño no repiten la composición de una portada de colección: usan una superficie elevada con borde, una trama técnica sutil, la etiqueta textual “Diseño original”, un número editorial, el precio como pill Lime y no incluyen contador ni flecha circular. Al elegir un diseño se cierra la colección y se abre el mismo estudio con el diseño cargado y visible en la polera 3D desde Detalles. En este recorrido, el motivo y su color de muestra quedan bloqueados: se puede elegir modelo, talla y únicamente ubicar el mismo estampado al frente o a la espalda; nunca se ofrece “ambos”, reemplazar ni quitar el archivo. La silueta CSS queda como alternativa si WebGL no está disponible. Se reutiliza un único renderizador para generar las vistas, sin mantener un contexto por tarjeta. Tres columnas en escritorio, dos en tablet y una en móvil; el diálogo usa dos columnas y una en móvil. Los modelos y tallas se eligen dentro del estudio; los motivos son originales y el precio mostrado no sustituye el resumen del pedido. El bloque de caminos creativos sigue inmediatamente después de la galería.
- **Páginas públicas del catálogo**: la jerarquía Producto → Colección → Diseño tiene rutas estables y legibles (`/productos/{producto}/{coleccion}/{diseno}/`). No funcionan como una copia aislada de la grilla: cada ruta es una landing útil con hero orientado a la intención de búsqueda, propuesta de valor, vista 3D, contenido editorial, proceso de compra, preguntas frecuentes, enlaces internos y un CTA final. La portada de producto organiza colecciones; la de colección contextualiza y lista sus diseños; la ficha de diseño presenta descripción, precio inicial, CTA al estudio y piezas relacionadas. Estas páginas reutilizan header, footer, tarjetas, componentes y tokens del home, mantienen tres, dos y una columna según el ancho y conservan una silueta HTML antes de cargar el visor 3D. El 3D es una mejora progresiva, no el único contenido visible ni el contenido indexable. Los enlaces circulares de las tarjetas abren la página correspondiente. Las páginas se generan desde el contenido público activo y deben regenerarse tras cambios editoriales para que contenido, canonical, datos estructurados y sitemap reflejen el catálogo publicado.
- **Franja de confianza**: precede al catálogo y comunica tres beneficios estables con ícono lineal, título y apoyo: diseños originales, despacho nacional y compra segura. En escritorio se distribuye en tres columnas separadas por divisores; en móvil se apila en una columna. Los íconos son decorativos porque el texto expresa toda la información.
- **Pie de página editorial**: separa en columnas la firma de marca, el catálogo indexable y el contacto. Las rutas SEO de producto y colección viven únicamente en el bloque Catálogo; el cierre legal y “Cómo funciona” ocupan una franja inferior con divisor. En tablet el contacto baja a una fila propia y en móvil todo se apila, conservando el catálogo en dos columnas y texto de lectura de al menos 14 px.
- **Panel administrativo**: usa una navegación lateral persistente, barra de búsqueda contextual y un área principal de trabajo. El catálogo sigue la jerarquía **Producto → Colección → Diseño**: Poleras, Imanes y Afiches son productos; cada colección pertenece obligatoriamente a uno y cada diseño pertenece a una colección. La vista Resumen prioriza métricas y acciones rápidas; las vistas de gestión usan encabezado, acción primaria, tabla y diálogo de edición. Pedidos se organiza como Kanban en cuatro columnas —ingresado, en proceso, para entrega/despacho y pedido terminado—; cada tarjeta muestra solo identificación, cliente, tipo de entrega, unidades, estado y total. El modal de detalle concentra contacto, dirección, productos, cobro, historial, etiqueta imprimible y la próxima acción válida. El cierre operativo depende de la entrega: un despacho termina al entregarlo a la transportista y un retiro termina al quedar listo en tienda; ambos pasan a “Pedido terminado”. El mismo stepper contextual aparece en el área privada del cliente. “Servicio al cliente” queda visible como vista planificada para incidencias posteriores al cierre, compensaciones y encuestas de satisfacción, sin mezclar aún esa operación con el flujo de pedidos. El panel permite ingresar ventas presenciales y administrar cupones con tipo, vigencia, compra mínima y límite de usos. En pantallas intermedias la navegación se reduce a iconos con nombre accesible; en móvil se convierte en una franja horizontal y las vistas planificadas comunican su alcance sin simular funcionalidad. Los estados activos y ocultos siempre incluyen texto además del color.
- **Tarjeta de producto**: distribuciones vertical, lateral y compacta. Mantener etiqueta, nombre, descripción y acción reconocibles en todas.
- **FAQ**: versión simple y versión con etiqueta/contexto. Cada grupo permite una sola respuesta abierta; `details/summary` conserva la operación por teclado.
- **Formulario del estudio**: selectores de modelo, color, talla, archivo y ubicación del estampado dentro de Detalles, seguido por Resumen y Datos y pago. El resumen termina con “Añadir al carro”. Desde el carro se ofrece iniciar sesión, crear cuenta, recuperar contraseña o comprar como invitado; los datos personales se piden recién después de esa elección. Los datos guardados en “Mis datos” se precargan en el checkout. Si una persona compra como invitada, puede crear su cuenta al finalizar y conservar los datos que ya ingresó. En Datos y pago, el despacho exige región, comuna y dirección: primero se calcula y muestra su importe junto al total, admite validar un cupón y recién entonces habilita el paso a pago. Retiro se cotiza explícitamente como gratis.
- **Confirmación antes de Mercado Pago**: después de validar los datos y calcular el despacho se abre un diálogo de resumen con el logo oficial RGB horizontal de Mercado Pago sobre superficie elevada blanca. El botón de Droska usa la acción primaria Ink y dice “Continuar a Mercado Pago”; el cobro sucede después, en Checkout Pro. El servidor recalcula subtotal, descuento y despacho antes de crear la preferencia. Si falla, el diálogo muestra un error y conserva el carro. El retorno del navegador comunica estado preliminar; la aprobación del pedido depende del webhook verificado.
- **Capas**: los modales usan la superficie elevada, radio de 18 px, sombra de capa, backdrop Ink translúcido con desenfoque y encabezado de altura intrínseca separado por un borde sutil; título, apoyo y contador deben quedar completamente dentro del encabezado, nunca invadir el cuerpo ni cruzar el divisor. El cierre se alinea al inicio del bloque, reutiliza `.ds-icon-button.close-button`, tiene nombre accesible y conserva el anillo Lilac del foco cuando corresponde a navegación por teclado. Los diálogos de formulario usan el ancho compacto del espécimen; el catálogo admite una variante amplia de hasta 1080 px para dos columnas, manteniendo los mismos tokens y una sola columna en móvil. El modal de cuenta ofrece navegación persistente entre “Mis pedidos” y “Mis datos”; la primera sección muestra el mismo stepper contextual que Administración, actualización en tiempo real, historial y detalles reales, y la segunda agrupa información personal y dirección en fieldsets visibles. El stepper usa cinco etapas para despacho (ingresado, preparando, preparado, en despacho y entregado) y cuatro para retiro (ingresado, preparando, listo para retirar y retirado); en móvil admite desplazamiento horizontal antes que comprimir etiquetas hasta volverlas ilegibles. Modal de cuenta y drawer de carro conservan una superficie distinguible, un cierre identificable y el contexto de origen. Las eliminaciones de colecciones y diseños siempre pasan por un diálogo de confirmación con acción Danger explícita; una colección con diseños no se puede eliminar hasta moverlos o eliminarlos primero, y un diseño referenciado por una compra se oculta en vez de borrarse. La confirmación de cuenta explica la caducidad del enlace y ofrece una acción visible para reenviarlo. El correo predeterminado de Supabase no permite personalizar esa plantilla; una futura confirmación por código requerirá configurar SMTP propio.

## 6. Implementación y mantenimiento

| Archivo | Responsabilidad |
| --- | --- |
| `src/design-system.css` | Tokens y primitives compartidos por el producto y el catálogo |
| `src/style.css` | Estilos de la aplicación principal |
| `src/accessibility.css` | Ajustes de accesibilidad compartidos |
| `design-system.html` | Catálogo visual y pares oficiales |
| `src/design-system-page.css` | Presentación exclusiva del catálogo |
| `src/design-system-page.js` | Interacciones de muestras y explorador de contraste |

Para una regla nueva: modifica el token o componente compartido, actualiza el catálogo y este documento, revisa su uso en la app y ejecuta `npm run build`, `npm test` y `npm run audit:a11y-colors` cuando haya cambios de color. Un cambio en la matriz exploratoria no modifica por sí solo la lista oficial.
