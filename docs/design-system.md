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

- **CTA principal (`.ds-cta`)**: Ink con texto inverso y sombra Pink sobre superficies claras. En superficies oscuras, los CTA de avance del estudio y de las tarjetas de diseño usan Pink con texto Ink en reposo; hover y foco usan Lime conservando texto Ink. Estos pares corresponden a `text-primary / brand-accent` y `text-primary / lime`. Un primario por contexto. Variantes con y sin flecha, tamaños S (44 px), M (54 px), L (62 px). La flecha nunca sustituye el texto.
- **Acción secundaria (`.ds-cta-ghost`, `.ds-secondary-button`)**: acompaña a la principal sin competir. Variante con o sin ícono.
- **Acción contextual (`.ds-guide-button`)**: acceso compacto, por ejemplo guía de tallas.
- **Controles de ícono (`.ds-icon-button`, `.ds-cart-button`)**: nombre accesible obligatorio; el contador del carro acompaña al ícono.
- **Selección (`.ds-choice-button`, `.ds-swatch-button`)**: estado seleccionado visible con borde/anillo, no solo con color. En el selector de modelo del estudio oscuro, hover y foco usan Pink 500 con texto Ink y borde inverso visible; corresponde al par oficial `text-primary / brand-accent`.
- **Cantidad (`.ds-quantity`)**: botones de aumentar y reducir con etiqueta accesible.
- **Campo (`.ds-field`)**: etiqueta, ayuda y validación. Se muestran reposo, foco, completo, error, éxito, disabled y solo lectura.
- **Alertas transitorias**: comunican éxito, información o error en español con ícono, texto explícito y contraste semántico. Los errores de autenticación traducen el mensaje técnico a una acción comprensible para la persona.
- **Otros controles**: radio, checkbox, búsqueda, filtro, rango y carga por selección o arrastre tienen especímenes en Forms. Búsqueda, filtro y rango actualizan su feedback en el catálogo.

Los controles documentan reposo, hover, activo, foco y disabled cuando corresponde; los selectores añaden selected y los enlaces pueden mostrar visited. El foco debe permanecer visible al navegar con teclado. Las muestras estáticas de estados no equivalen a controles de producción completamente conectados.

## 5. Patrones de contenido

- **Administración de insumos**: un acceso “Gestionar insumos” ofrece crear un insumo, editar sus datos o administrar categorías. El paso siguiente distingue principal y secundario; al editar, una búsqueda filtra una lista de insumos con nombre y categoría y exige elegir uno antes de continuar. Cada fila ofrece “Cambiar categoría” para mover ese insumo dentro de su grupo. Las categorías se muestran como filas compactas: “Editar” abre el campo de nombre de una sola categoría, con Guardar y Cancelar; crear una nueva tiene su sección propia. Renombrar conserva los insumos asociados. Los diálogos usan etiquetas visibles, cierre claro y opciones con texto además del estado visual.
- **Encabezado de sección**: eyebrow opcional, título obligatorio, texto de apoyo opcional y divisor contextual. Se muestran versiones editorial, compacta y móvil apilada.
- **Header del estudio**: marca y cierre persistentes; el contexto se muestra completo, abreviado o en segunda línea según el espacio.
- **Navegación de productos**: el header concentra las familias bajo “Productos” y la acción “Crear mi polera”; no muestra enlaces secundarios a “Cómo funciona” ni “El estudio”. El disparador conserva el mismo tamaño, peso y línea base que los enlaces vecinos y señala el estado abierto con un subrayado Pink. El menú se ancla y centra bajo el disparador; la familia disponible usa una fila destacada con descripción y acción, mientras las familias futuras se mantienen como filas livianas no interactivas con descripción y etiqueta “Próximamente”. En modo oscuro el desplegable usa una superficie Ink elevada, borde Pink en la opción activa y estados futuros legibles sobre separadores sutiles. El divisor inferior del header ocupa siempre el 100% del viewport, aunque el contenido de navegación conserve su ancho centrado. El desplegable opera con `details/summary`, conserva foco visible y se cierra al elegir una opción o pulsar fuera. En móvil ocupa el ancho útil sin caret flotante.
- **Apariencia pública**: la tienda carga en modo oscuro por defecto (`droska-theme=dark`). El selector no aparece en la navegación pública; Administración → Configuración → Modo de color controla la preferencia compartida y la próxima carga de la tienda aplica claro u oscuro. El skeleton de carga toma esa misma preferencia antes de cargar JavaScript: parte en negro por defecto y solo muestra su variante clara si el ajuste guardado es claro. En modo oscuro, la base de página, cabecera, menús y superficies oscuras usan negro puro (`#000`); Pink y Lilac se reservan para acentos y profundidad localizada. La franja de anuncio superior usa Lime con texto Ink en ambos temas.
- **Configuración de comunicaciones**: el resumen de plantillas de email se mantiene plegado por defecto para priorizar los ajustes. La previsualización se carga únicamente al expandir “Vista temporal de plantillas”; el acceso “Abrir aparte” permanece disponible para revisarla en una pestaña independiente.
- **Fondos atmosféricos**: en modo oscuro, las áreas de catálogo pueden usar gradientes ambientales de baja intensidad con `Brand Pink`, `Brand Lilac` y `Lime` sobre `Brand Ink`. La banda de color ocupa el 100% del viewport aunque la grilla conserve su ancho de lectura. Deben funcionar como profundidad alrededor del contenido, sin competir con fotografías, mockups ni CTA.
- **Hero rotativo**: alterna automáticamente entre los dos caminos principales cada seis segundos. Sus controles numerados permiten seleccionar una vista, se pausa al posar el cursor o mover el foco dentro del bloque y ofrece un control explícito para pausar o reanudar. Ambas slides comparten la misma retícula editorial de ancho completo y el mismo padding lateral: copy a la izquierda, escenario y mockup a la derecha, rieles técnicos fuera de la jerarquía accesible y una trama de dots sutil. El hero no incluye selectores de color: esa elección ocurre dentro del estudio de personalización. La primera lámina usa una única imagen WebP estática de alta calidad —foto de origen, flecha y polera personalizada de destino— para comunicar el concepto sin cargar el modelo ni el visor 3D en la portada. En modo oscuro, la imagen ambiente de ambas láminas queda bajo un velo Ink pronunciado: Pink y Lilac aportan profundidad localizada, sin competir con el copy ni los mockups. La primera integra además la escena cyberpunk Pink, borde técnico y halo luminoso; no reutiliza sin adaptación la superficie Lilac del modo claro. La palabra variable del titular usa Pink con una línea Lilac separada del glifo, evitando fondos claros detrás del texto. La lámina de catálogo usa una trama de puntos blancos sutil sobre el fondo nocturno y puede sumar señalética editorial decorativa —rieles técnicos laterales, estrella Pink y etiqueta superior— siempre fuera de la jerarquía accesible, sin tapar contenido ni controles. Sus tres mockups ocupan columnas anchas y cercanas; el central puede dominar la composición, pero debe conservar completa su tarjeta dentro del hero y nunca invadir la franja inferior. Los rieles se ocultan en tablet y toda la señalética desaparece en móvil. Con `prefers-reduced-motion` no rota automáticamente.
- **Portadas de colección**: la portada toma la última polera publicada en su colección; nunca queda fijada al primer diseño histórico. El orden de apertura también muestra primero la incorporación más reciente.
- **Progreso del estudio**: tres pasos (Detalles, Resumen, Datos y pago), con paso actual identificable por texto además del estilo. En una personalización propia, Detalles reúne modelo, color, talla, carga del archivo y ubicación del estampado, incluyendo las caras necesarias. El selector ofrece únicamente variantes vinculadas a un insumo desde Administración; no muestra tallas sin respaldo operativo. Al terminar de cargar un archivo, el mockup 3D se actualiza en ese mismo paso. Si requiere revisión técnica, se comunica allí y se desglosa en el resumen sin añadir una pantalla intermedia. Contacto, despacho o retiro y acceso opcional a cuenta aparecen juntos al final, inmediatamente antes de confirmar.
- **Tarjeta de camino creativo**: desde 1440 px, arte y tres pasos horizontales comparten dos columnas. Entre 1000 y 1439 px, la polera ocupa la columna derecha y los tres pasos se leen verticalmente, junto al título y al CTA en la izquierda. Entre 761 y 999 px, el arte tiene una franja propia y los pasos conservan el ancho completo en una fila. En móvil, el proceso se apila y el CTA conserva el ancho útil. No comprimas tres pasos horizontales dentro de una columna estrecha.
- **Catálogo de prediseñadas**: la vista inicial muestra una portada por colección; cada portada tiene una polera 3D, nombre, acción para abrirla y una pill blanca con ícono de polera y cantidad de diseños activos calculada desde el contenido real de esa colección, nunca escrita manualmente. Cada diseño guarda además un color de polera de muestra —elegido explícitamente en el panel con nombre, swatch y estado seleccionado visible— que se reutiliza en su portada 3D y al abrirlo en el estudio; el color nunca se comunica como única señal. La etiqueta respeta singular y plural. En el mockup 3D, `100%` representa el área segura máxima, no el lienzo bruto del archivo: el visor descarta el margen transparente para calcular la proporción visible y reduce automáticamente las piezas verticales para mantenerlas centradas sobre el pecho. Los diseños de colección parten en una ocupación amplia de pecho, equivalente a la referencia editorial, y aún permiten reducir su tamaño desde el control del estudio. El análisis preserva píxeles semitransparentes y deja un margen de seguridad para no cortar esquinas, tramas o salpicaduras del diseño. Las portadas de colección son más altas para mostrar la polera completa a un tamaño útil; el encuadre inicial privilegia la prenda y el estampado sin cortar cuello ni basta. Las portadas alternan fondos Pink, Lilac, Lime y mixtos según su posición para distinguir colecciones sin alterar su contenido. En dispositivos con hover, la prenda se acerca aún más hasta privilegiar el área del estampado, aunque cuello y basta queden parcialmente fuera del marco; el contenedor y los controles permanecen inmóviles, el foco de teclado activa la misma señal y `prefers-reduced-motion` elimina la transición. Formas orgánicas translúcidas y tres trazos Pink decoran el fondo detrás de la prenda; son elementos no informativos y no interfieren con texto ni controles. Al abrir una colección, sus diseños aparecen en un diálogo modal y las portadas permanecen en su lugar detrás; el diálogo tiene título, contador, cierre visible y también se cierra al pulsar el fondo. Las tarjetas de diseño no repiten la composición de una portada de colección: usan una superficie elevada con borde, una trama técnica sutil, la etiqueta textual “Diseño original”, un número editorial, el precio como pill Lime y no incluyen contador ni flecha circular. Al elegir un diseño se cierra la colección y se abre el mismo estudio con el diseño cargado y visible en la polera 3D desde Detalles. En este recorrido, el motivo y su color de muestra quedan bloqueados: se puede elegir modelo, talla y únicamente ubicar el mismo estampado al frente o a la espalda; nunca se ofrece “ambos”, reemplazar ni quitar el archivo. La silueta CSS queda como alternativa si WebGL no está disponible. Se reutiliza un único renderizador para generar las vistas, sin mantener un contexto por tarjeta. Tres columnas en escritorio, dos en tablet y una en móvil; el diálogo usa dos columnas y una en móvil. Los modelos y tallas se eligen dentro del estudio; los motivos son originales y el precio mostrado no sustituye el resumen del pedido. El bloque de caminos creativos sigue inmediatamente después de la galería.
- **Páginas públicas del catálogo**: la jerarquía Producto → Colección → Diseño tiene rutas estables y legibles (`/productos/{producto}/{coleccion}/{diseno}/`). No funcionan como una copia aislada de la grilla: cada ruta es una landing útil con hero orientado a la intención de búsqueda, propuesta de valor, vista 3D, contenido editorial, proceso de compra, preguntas frecuentes, enlaces internos y un CTA final. La portada de producto organiza colecciones; la de colección contextualiza y lista sus diseños; la ficha de diseño presenta descripción, precio inicial, CTA al estudio y piezas relacionadas. Estas páginas reutilizan header, footer, tarjetas, componentes y tokens del home, mantienen tres, dos y una columna según el ancho y conservan una silueta HTML antes de cargar el visor 3D. El 3D es una mejora progresiva, no el único contenido visible ni el contenido indexable. Los enlaces circulares de las tarjetas abren la página correspondiente. Las páginas se generan desde el contenido público activo y deben regenerarse tras cambios editoriales para que contenido, canonical, datos estructurados y sitemap reflejen el catálogo publicado.
- **Franja de confianza**: precede al catálogo y comunica tres beneficios estables con ícono lineal, título y apoyo: diseños originales, despacho nacional y compra segura. En escritorio se distribuye en tres columnas separadas por divisores; en móvil se apila en una columna. Los íconos son decorativos porque el texto expresa toda la información.
- **Pie de página editorial**: separa en columnas la firma de marca, el catálogo indexable y el contacto. Las rutas SEO de producto y colección viven únicamente en el bloque Catálogo; el cierre legal y “Cómo funciona” ocupan una franja inferior con divisor. En tablet el contacto baja a una fila propia y en móvil todo se apila, conservando el catálogo en dos columnas y texto de lectura de al menos 14 px.
- **Carga del panel administrativo**: el HTML inicial muestra una tarjeta centrada con el logo oficial de Droska sobre blanco, título y estado de espera legible. La barra animada es indeterminada y decorativa: nunca indica un porcentaje inventado. Usa superficies y texto semánticos del modo claro, conserva contraste AA y detiene ambas animaciones con `prefers-reduced-motion`.
- **Pago de pedidos**: cada tarjeta y detalle muestra una etiqueta textual independiente del avance operativo: “No pagado” por defecto, “Pagado por revisar” cuando existe un aviso de transferencia o un cobro aprobado por el proveedor, y “Pagado” en verde solo después de la confirmación atribuida a administración. Las tres usan roles oficiales con texto inverso y contraste AA. El cobro del proveedor no inicia producción; la confirmación manual habilita el siguiente paso.
- **Panel administrativo**: usa una navegación lateral persistente, barra de búsqueda contextual y un área principal de trabajo. El catálogo sigue la jerarquía **Producto → Colección → Diseño**: Poleras, Imanes y Afiches son productos; cada colección pertenece obligatoriamente a uno y cada diseño pertenece a una colección. La vista Resumen prioriza métricas y acciones rápidas; las vistas de gestión usan encabezado, acción primaria, tabla y diálogo de edición. Pedidos se organiza como Kanban en cuatro columnas —ingresado, en proceso, para entrega/despacho y pedido terminado—; cada tarjeta muestra solo identificación, cliente, tipo de entrega, unidades, estado y total. El modal de detalle concentra contacto, dirección, productos, cobro, historial, etiqueta imprimible y la próxima acción válida. El cierre operativo depende de la entrega: un despacho termina al entregarlo a la transportista y un retiro termina al quedar listo en tienda; ambos pasan a “Pedido terminado”. El mismo stepper contextual aparece en el área privada del cliente. “Servicio al cliente” queda visible como vista planificada para incidencias posteriores al cierre, compensaciones y encuestas de satisfacción, sin mezclar aún esa operación con el flujo de pedidos. El panel permite ingresar ventas presenciales y administrar cupones con tipo, vigencia, compra mínima y límite de usos. En pantallas intermedias la navegación se reduce a iconos con nombre accesible; en móvil se convierte en una franja horizontal y las vistas planificadas comunican su alcance sin simular funcionalidad. Los estados activos y ocultos siempre incluyen texto además del color.
- **Tarjeta de producto**: distribuciones vertical, lateral y compacta. Mantener etiqueta, nombre, descripción y acción reconocibles en todas.
- **FAQ**: versión simple y versión con etiqueta/contexto. Cada grupo permite una sola respuesta abierta; `details/summary` conserva la operación por teclado.
- **Formulario del estudio**: selectores de modelo, color, talla, archivo y ubicación del estampado dentro de Detalles, seguido por Resumen y Datos y pago. El resumen termina con “Añadir al carro”. Desde el carro se ofrece iniciar sesión, crear cuenta, recuperar contraseña o comprar como invitado; los datos personales se piden recién después de esa elección. Los datos guardados en “Mis datos” se precargan en el checkout. Si una persona compra como invitada, puede crear su cuenta al finalizar y conservar los datos que ya ingresó. En Datos y pago, el despacho exige región, comuna y dirección: primero se calcula y muestra su importe junto al total, admite validar un cupón y recién entonces habilita el paso a pago. Retiro se cotiza explícitamente como gratis. En modo oscuro, el resumen, el bloque de cuenta, las opciones de entrega, los datos de contacto, el cupón y sus menús usan superficies Ink con texto inverso; la opción seleccionada y el despacho calculado usan Lime con texto Ink. Las ayudas y etiquetas mantienen contraste AA en ambos modos.
- **Confirmación antes de Mercado Pago**: después de validar los datos y calcular el despacho se abre un diálogo de resumen con el logo oficial RGB horizontal de Mercado Pago sobre superficie elevada blanca. El botón de Droska usa la acción primaria Ink y dice “Continuar a Mercado Pago”; el cobro sucede después, en Checkout Pro. El servidor recalcula subtotal, descuento y despacho antes de crear la preferencia. Si falla, el diálogo muestra el error específico devuelto por el servidor y conserva el carro. La opción de transferencia se comprueba al abrir el diálogo y permanece deshabilitada con una explicación si faltan los datos bancarios de producción. El botón “Ir a pagar” y la confirmación muestran un indicador y un mensaje de espera, deshabilitan nuevos envíos durante la preparación y recuperan la acción si ocurre un error. En modo oscuro, las opciones de pago usan Ink con texto inverso y la seleccionada Lilac 500 con texto inverso; el CTA usa Pink con texto Ink, y el logo oficial conserva una base blanca. El retorno del navegador comunica estado preliminar; el webhook verificado acredita el cobro y deja el pedido por revisar; administración confirma el estado Pagado.
- **Capas**: los modales usan la superficie elevada, radio de 18 px, sombra de capa, backdrop Ink translúcido con desenfoque y encabezado de altura intrínseca separado por un borde sutil; título, apoyo y contador deben quedar completamente dentro del encabezado, nunca invadir el cuerpo ni cruzar el divisor. En modo oscuro, header, anuncio, menús, modales y drawers cambian juntos a superficies Ink: no se permiten cabeceras ni cuerpos blancos aislados, salvo recursos de marca que exijan su propia base. Campos, cierres, resúmenes bloqueados de catálogo y controles mantienen borde visible, texto inverso y foco Lilac. El cierre se alinea al inicio del bloque, reutiliza `.ds-icon-button.close-button`, tiene nombre accesible y conserva el anillo Lilac del foco cuando corresponde a navegación por teclado. Los diálogos de formulario usan el ancho compacto del espécimen; el catálogo admite una variante amplia de hasta 1080 px para dos columnas, manteniendo los mismos tokens y una sola columna en móvil. El modal de cuenta ofrece navegación persistente entre “Mis pedidos” y “Mis datos”; la primera sección muestra el mismo stepper contextual que Administración, actualización en tiempo real, historial y detalles reales, y la segunda agrupa información personal y dirección en fieldsets visibles. El stepper usa cinco etapas para despacho (ingresado, preparando, preparado, en despacho y entregado) y cuatro para retiro (ingresado, preparando, listo para retirar y retirado); en móvil admite desplazamiento horizontal antes que comprimir etiquetas hasta volverlas ilegibles. Modal de cuenta y drawer de carro conservan una superficie distinguible, un cierre identificable y el contexto de origen. Las eliminaciones de colecciones y diseños siempre pasan por un diálogo de confirmación con acción Danger explícita; una colección con diseños no se puede eliminar hasta moverlos o eliminarlos primero, y un diseño referenciado por una compra se oculta en vez de borrarse. La confirmación de cuenta explica la caducidad del enlace y ofrece una acción visible para reenviarlo. El correo predeterminado de Supabase no permite personalizar esa plantilla; una futura confirmación por código requerirá configurar SMTP propio.

## 6. Implementación y mantenimiento

En la ruta “Tengo una idea”, se pueden adjuntar hasta cinco fotos de referencia JPG, PNG o WEBP de 50 MB cada una. El formulario muestra cuántas se han cargado y permite quitar una para agregar otra al llegar al límite. Adjuntar o quitar una referencia conserva todos los campos ya escritos. El éxito muestra un número de solicitud. Las referencias privadas se presentan al administrador como acciones “Abrir”, con error y reintento si falla el enlace. La cotización aparece en “Mis pedidos” con su mensaje, monto y acción de pago; el estado se expresa con texto además del color.

| Archivo | Responsabilidad |
| --- | --- |
| `src/design-system.css` | Tokens y primitives compartidos por el producto y el catálogo |
| `src/style.css` | Estilos de la aplicación principal |
| `src/accessibility.css` | Ajustes de accesibilidad compartidos |
| `design-system.html` | Catálogo visual y pares oficiales |
| `src/design-system-page.css` | Presentación exclusiva del catálogo |
| `src/design-system-page.js` | Interacciones de muestras y explorador de contraste |

Para una regla nueva: modifica el token o componente compartido, actualiza el catálogo y este documento, revisa su uso en la app y ejecuta `npm run build`, `npm test` y `npm run audit:a11y-colors` cuando haya cambios de color. Un cambio en la matriz exploratoria no modifica por sí solo la lista oficial.

## 7. Ficha técnica completa

Esta sección reúne los valores concretos que se deben consultar al implementar una pantalla. Los nombres y valores salen de `src/design-system.css`, `design-system.html` y de la lógica de producto relacionada. Si un valor visual aparece solo en `src/design-system-page.css`, corresponde al catálogo y no debe copiarse automáticamente a la tienda.

### 7.1 Tokens de color implementados

#### Escalas base

| Familia | Tokens implementados |
| --- | --- |
| Neutral | `950 #1B1D18`, `900 #262920`, `700 #52554D`, `600 #6F726A`, `300 #D8D3CA`, `50 #F9F7F2` |
| Pink | `950 #7A063C`, `800 #B71561`, `700 #CF2C78`, `500 #F957A4`, `300 #F7C6DA`, `50 #FFF4F9` |
| Lime | `950 #405B08`, `700 #759C18`, `500 #DFFF78`, `50 #FBFFF1` |
| Lilac | `950 #38235F`, `700 #6A529C`, `500 #6652C5`, `200 #DED6F5`, `50 #F5F2FF` |
| Feedback | Success `#2F6B2F`, Warning `#9A4D00`, Danger `#B42318`, Info `#275DAB` |

#### Roles semánticos

| Rol | Token CSS | Valor actual | Uso |
| --- | --- | --- | --- |
| Marca principal | `--ds-brand-primary` | Neutral 900 | Identidad, texto principal y acción primaria |
| Acento de marca | `--ds-brand-accent` | Pink 500 | Acentos, hover de selección y sombra del CTA |
| Marca secundaria | `--ds-brand-secondary` | Lilac 500 | Foco y bloques expresivos |
| Fondo de página | `--ds-surface-page` | Neutral 50 | Fondo general |
| Superficie elevada | `--ds-surface-raised` | `#FFFDFA` | Tarjetas, diálogos y controles |
| Superficie sutil | `--ds-surface-subtle` | Lilac 50 | Paneles suaves y estados auxiliares |
| Superficie disabled | `--ds-surface-disabled` | `#E5E3DF` | Controles no disponibles |
| Texto primario | `--ds-text-primary` | Neutral 900 | Títulos y lectura principal |
| Texto secundario | `--ds-text-secondary` | Neutral 700 | Descripciones y apoyo |
| Texto terciario | `--ds-text-tertiary` | Neutral 600 | Metadata secundaria |
| Texto inverso | `--ds-text-inverse` | Blanco | Texto sobre Ink y feedback |
| Texto disabled | `--ds-text-disabled` | Neutral 700 | Estado disabled; nunca única señal de estado |
| Texto acento | `--ds-text-accent` | Pink 700 | Énfasis textual sobre fondos claros |
| Borde de control | `--ds-border-control` | Neutral 600 | Inputs, selectores y controles |
| Borde sutil | `--ds-border-subtle` | Neutral 300 | Divisores y contornos suaves |
| Acción primaria | `--ds-action-primary` | Neutral 900 | CTA, carro y acción principal |
| Hover primario | `--ds-action-primary-hover` | `#3E4239` | Acción primaria en hover |
| Active primario | `--ds-action-primary-active` | Neutral 950 | Acción primaria presionada |
| Foco | `--ds-focus-ring` | Lilac 500 | Anillo de foco visible |
| Ícono | `--ds-icon-default` | Neutral 900 | Íconos principales |
| Ícono muted | `--ds-icon-muted` | Neutral 700 | Íconos de apoyo |
| Feedback | `--ds-feedback-success/warning/danger/info` | Verde / ámbar / rojo / azul | Estados semánticos con texto o ícono adicional |

No se agregan hexadecimales directamente en un componente si ya existe un rol semántico equivalente.

### 7.2 Tipografía y tamaños

| Token de uso | Familia y peso | Tamaño / interlínea | Tracking | Aplicación |
| --- | --- | --- | --- | --- |
| `display-xl` | Space Grotesk 700 | `72 / 68 px` | `-4 px` | Hero principal |
| `heading-1` | Space Grotesk 700 | `52 / 52 px` | `-2.4 px` | Título de página |
| `heading-2` | Space Grotesk 700 | `38 / 40 px` | `-1.6 px` | Título de sección |
| `heading-3` | Space Grotesk 700 | `26 / 30 px` | `-.8 px` | Bloque o modal |
| `body-lg` | DM Sans 400 | `18 / 28 px` | Normal | Introducciones |
| `body-md` | DM Sans 400 | `15 / 24 px` | Normal | Lectura general |
| `label` | DM Sans 700 | `12 / 16 px` | Normal | Controles y etiquetas |
| `eyebrow` | DM Sans 700 | `10 / 15 px` | `+1.5 px` | Categoría breve en mayúsculas |
| `accent` | Caveat 600 | `32 / 34 px` | Normal | Nota expresiva breve |

Fuentes y respaldos:

- `--ds-font-display`: `'Space Grotesk', sans-serif` — para producto se prefiere `Arial, sans-serif` como respaldo explícito.
- `--ds-font-body`: `'DM Sans', sans-serif` — para producto se prefiere `Arial, sans-serif` como respaldo explícito.
- `--ds-font-accent`: `'Caveat', 'Comic Sans MS', cursive`.
- Caveat se usa desde 24 px y nunca para controles, precios, errores o información esencial.
- En móvil los títulos pueden usar `clamp()`. El texto de lectura nunca debe bajar de 14 px.

### 7.3 Geometría, elevación y movimiento

| Token / regla | Valor | Aplicación |
| --- | --- | --- |
| `--ds-radius-pill` | `999 px` | CTA, tags, chips, carro y selectores redondos |
| `--ds-radius-control` | `12 px` | Botones de ícono y controles compactos |
| Campo | `9 px` | Inputs y mensajes de formulario |
| Tarjeta expresiva | `16–20 px` | Tarjetas de caminos y piezas editoriales |
| Diálogo | `18 px` | Modal de comercio y catálogo |
| `--ds-shadow-cta` | `0 4px 0 #E8458E` | CTA en reposo |
| `--ds-shadow-control` | `0 3px 0 #E1DDD5` | Control cuadrado |
| Transición | `200 ms ease` | Hover, active, foco visual y elevación |
| Foco de control | `3 px`, offset `3 px` | Teclado en controles |
| Foco elevado | `3 px`, offset `7 px` | Íconos y controles sobre capas |

El hover del CTA sube `2 px` y aumenta la sombra; active baja el control y reduce la sombra. La animación se elimina o reduce cuando corresponde a `prefers-reduced-motion`.

### 7.4 Componentes: medidas y tratamiento

| Componente | Medidas base | Reglas |
| --- | --- | --- |
| `.ds-cta--sm` | Alto mínimo `44 px`, padding horizontal `17 px`, texto `12 px` | Navegación |
| `.ds-cta--md` | Alto mínimo `54 px`, padding `22 px`, texto `15 px` | Uso estándar |
| `.ds-cta--lg` | Alto mínimo `62 px`, padding `27 px`, texto `17 px` | Momento clave |
| `.ds-cta` | Gap texto–ícono `28 px`, radio pill | Un solo primario por contexto; la flecha no reemplaza texto |
| `.ds-cta-ghost` / `.ds-secondary-button` | Alto mínimo `54 px`, padding `20 px`, texto `14 px` | Acción alternativa |
| `.ds-icon-button` | `40 × 40 px`, radio `12 px` | Siempre con nombre accesible |
| `.ds-cart-button` | `45 × 40 px`, ícono `19 px`, contador mínimo `19 px` | El contador acompaña al ícono |
| `.ds-guide-button` | Alto mínimo `38 px`, ícono circular `25 px`, texto `10 px` | Acción contextual compacta |
| `.ds-choice-button` | Mínimo `42 × 42 px`, padding `9 px`, radio `12 px` | Selección de modelo/talla; selected usa borde de `2 px` y Lime |
| `.ds-swatch-button` | `30 × 30 px`, circular | Selección con anillo; nunca comunicar solo por color |
| `.ds-quantity` | Padding `3 px`, gap `8 px`, botones `22 × 22 px` | Aumentar/reducir con etiqueta accesible |
| `.ds-field` | Padding `14 px`, borde `1 px`, radio `9 px` | Label, ayuda, validación y estado |

Todos los controles documentan reposo, hover, active, foco y disabled; los selectores agregan selected y los enlaces pueden agregar visited.

### 7.5 Tratamiento de imágenes e ilustraciones

#### Archivos de usuario y catálogo

- Formatos aceptados: PNG, JPG/JPEG y WebP. El archivo de origen puede pesar hasta 50 MB.
- El archivo debe decodificarse correctamente antes de aceptarse.
- En catálogo, se conserva el original si pesa como máximo 10 MB y su lado mayor no supera 4.800 px.
- Si supera 10 MB o 4.800 px, se redimensiona proporcionalmente y se convierte a WebP antes de enviarlo al bucket público `catalog-designs`.
- En Administración, cada diseño puede incluir una foto de mockup de polera para su portada de catálogo y otra opcional para hover. Ambas son editoriales: no sustituyen el archivo de estampado ni la vista 3D cuando no existe una foto.
- Los diseños propios se conservan localmente en IndexedDB por 15 días; el envío remoto ocurre solo al guardar en la cuenta o iniciar el pago.
- No reemplazar el original del cliente por un preview comprimido: el preview es una representación, el original es parte de la producción.

#### Recorte visual y área segura

- El visor analiza el canal alfa y descarta el margen transparente excesivo, preservando píxeles semitransparentes y detalles suaves.
- El umbral de visibilidad del análisis es alfa mayor que `1` en el visor; una imagen completamente transparente no obtiene límites visibles.
- Alrededor del contenido visible se agrega un margen de seguridad aproximado de `8%` y el resultado se limita a un máximo técnico de `1600 px` por lado mayor.
- Si el arte ocupa casi todo el lienzo (`>97%` del área analizada), no se recorta: se agrega un gutter transparente para proteger esquinas y bordes.
- `100%` es la escala base del área de estampado, no el tamaño bruto del lienzo. El estudio inicia los diseños propios en `160%` y los de catálogo en `170%`, con control desde `55%` hasta ese valor. Antes de proyectar, el visor muestrea los bordes visibles del canal alfa y reduce solo las piezas que exceden la superficie real del modelo y lado elegidos.
- Escala automática por proporción visible: menor a `0.5` → `0.82`; menor a `0.72` → `0.88`; menor a `0.9` → `0.95`; desde `0.9` → `1`. Las piezas verticales conservan un margen estrecho, sin reducir su lectura innecesariamente.
- El mockup conserva un tamaño grande cuando la forma visible cabe sobre la tela; ajusta las piezas verticales y las centra para evitar cortes en pecho, cuello, costuras y basta.

#### Mockup 3D y portada

- La variante Oversize conserva hombros y pecho definidos sobre un cuerpo invisible, con holgura que crece gradualmente desde debajo del pecho hasta la basta, tanto de frente como de perfil: no se entalla en el abdomen. El abdomen tiene menor proyección que la básica: la amplitud corresponde a tela suelta, sin aumentar el volumen del cuerpo. Conserva mangas relajadas y pliegues suaves. La referencia vigente son las vistas de Oversized T-Shirt de Yuri Arouca y las vistas de frente, perfil, espalda y malla aportadas el 9 de octubre de 2026: la línea del hombro baja suavemente desde el cuello, la axila es baja, las mangas son largas y caen casi verticales, y el torso es casi recto con canales verticales suaves. El puño, el cuello y la basta conservan el dobladillo de la malla, con borde fino y una banda de tela sutil; las aberturas tienen sombreado interior. Los pliegues son amplios y se suavizan las discontinuidades de iluminación entre islas UV; se suaviza la arruga horizontal de la cintura sin borrar el volumen del pecho. La malla es una aproximación propia basada en esas vistas.

- La aplicación usa el modelo `public/shirt.glb` con material mate: `roughness .96`, `metalness 0`, textura normal suave y oclusión ambiental.
- Los archivos propios y los diseños prediseñados del catálogo se proyectan con `DecalGeometry` sobre la malla activa y se separan `0.0012` de la tela para evitar z-fighting. Esto hace que el estampado acompañe los pliegues y límites de la prenda durante el giro.
- La proyección del estudio usa una profundidad de `1` unidad para alcanzar la curvatura del pecho y la espalda sin perder los bordes del arte. La comprobación del contorno visible contra la malla se repite para cada archivo, modelo, lado y tamaño, incluidos diseños futuros. Si una malla no ofrece una superficie continua ni al tamaño mínimo, el visor conserva el diseño completo en una capa frontal.
- El decal de archivos propios conserva triángulos orientados hacia el frente o la espalda (`normal Z ≥ .52`), evitando que el estampado se envuelva por los costados. Los diseños de catálogo usan `normal Z ≥ .32` para preservar sus bordes amplios mientras continúan ajustados a la malla.
- Al girar, la opacidad se desvanece suavemente entre facing `.16` y `.42`; no aparece un salto visual.
- Las portadas hero y catálogo usan una vista plana frontal para conservar el PNG completo; el estudio usa proyección sobre tela y permite giro.
- La prenda se muestra con `object-fit: contain`, sombra suave y fondos Pink, Lilac, Lime o neutros. Los fondos decorativos son no informativos y no deben competir con texto ni controles.
- El foco de teclado activa la misma señal visual que hover. Con `prefers-reduced-motion` se elimina la transición de acercamiento.
- La ausencia de WebGL debe conservar una silueta o portada HTML legible; el 3D es mejora progresiva, no contenido único.

### 7.6 Responsive y accesibilidad

| Rango | Regla principal |
| --- | --- |
| `≥1440 px` | Caminos creativos en dos columnas: arte + tres pasos horizontales |
| `1000–1439 px` | Polera en columna derecha; pasos verticales junto al título y CTA |
| `761–999 px` | Arte en franja propia; pasos en una fila de ancho completo |
| `≤760 px` | Contenido apilado; CTA conserva ancho útil; navegación se compacta |
| `≤640 px` | Grillas de tarjetas a una columna; diálogos y formularios ocupan una columna |
| `≤420 px` | Variantes de CTA pasan a una columna |

Reglas obligatorias:

- Todo control debe poder operarse con teclado y conservar un anillo de foco visible.
- Las etiquetas son visibles; los íconos decorativos llevan `aria-hidden` y los íconos funcionales tienen nombre accesible.
- Estado selected, activo, error, éxito, oculto o disabled siempre tiene una señal textual, estructural o de ícono además del color.
- Texto normal: mínimo `4.5:1`; texto grande: mínimo `3:1`. Bordes e íconos significativos: criterio interno mínimo `3:1`.
- No usar la etiqueta `UI` del explorador como autorización para texto normal.
- Los modales deben conservar contexto, cierre visible, foco gestionado y cierre por fondo cuando el patrón lo documente.
- En tablas y steppers móviles se prefiere desplazamiento horizontal a comprimir texto hasta volverlo ilegible.

### 7.7 Checklist de implementación

Antes de aprobar una nueva interfaz:

1. Usa tokens semánticos, no hexadecimales locales.
2. Elige una familia tipográfica y un nivel de la escala documentada.
3. Define reposo, hover, active, foco, disabled y selected cuando aplique.
4. Verifica área táctil, teclado, nombre accesible y señal que no dependa solo del color.
5. Si hay imágenes, valida formato, peso, dimensiones, transparencia, recorte y área segura.
6. Comprueba los cuatro rangos responsive relevantes y `prefers-reduced-motion`.
7. Actualiza este documento y el catálogo si aparece una regla nueva.
8. Ejecuta `npm run build`, `npm test` y, si hubo cambios de color, `npm run audit:a11y-colors`.
