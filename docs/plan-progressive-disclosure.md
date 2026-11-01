# Plan de revelación progresiva de formularios

Fecha: 19 de octubre de 2026. Estado: muestra aprobada por el usuario; motor, DS, Detalles, recorridos de solicitud/contacto/checkout, Mis datos y los formularios administrativos F09–F19 integrados. La verificación integral con una sesión administrativa real sigue pendiente. Ver [resultados y capturas](evaluations/progressive-disclosure.md).

## Objetivo y diagnóstico

Mostrar una decisión a la vez, conservar cada respuesta como resumen visible y editable, y habilitar lo siguiente solo cuando corresponda. Evitar que seleccionar algo obligue a recorrer otra vez todo el formulario.

Las capturas corresponden al primer paso del estudio. El código ya separa Detalles, Resumen y Datos y pago, pero dentro de Detalles renderiza simultáneamente producto, modelo, talla, color y ubicación. `src/studio-sequence.js` define ese orden y conserva scroll/foco; todavía no controla desbloqueo, confirmación ni resúmenes por decisión. Hay valores predeterminados en el estado: una opción precargada no equivale a una elección confirmada.

Inventario basado en `src/main.js`, `src/pet-personalization.js`, `src/admin.js` y `src/admin-supplier-products.js`, contrastado con README y DS. Incluye grupos interactivos aunque no tengan un `<form>` propio. Es una revisión de código y capturas; la validación interactiva queda dentro del plan.

## Modelo de interacción definido

**Acordeón secuencial con memoria visible**, dentro de las etapas generales existentes. Cada decisión tiene encabezado, contenido activo y resumen al completarse. Solo hay un bloque de edición abierto por recorrido; los completados siguen visibles y los futuros muestran únicamente título y estado pendiente.

| Situación | Comportamiento acordado para implementar |
| --- | --- |
| Inicio | Abrir la primera decisión sin confirmar. Mostrar contexto ya elegido, como el diseño de colección. |
| Elección única por tarjetas | Clic, toque o activación explícita por teclado confirma, pliega en resumen y abre la siguiente decisión. Navegar opciones con flechas no provoca avance. Anunciar antes que elegir continúa. |
| Texto, selección múltiple o archivos | Guardar los cambios en el estado del recorrido; avanzar con un botón explícito «Continuar». No avanzar al escribir, perder foco o cargar un archivo. |
| Paso completado | Mostrar «✓ Talla: Mediana» y «Editar». Para imágenes, miniatura, nombre y estado de validación. |
| Única alternativa válida | Mostrar «Color: Beige · Única opción» como dato resuelto, sin exigir clic. No aplicar esta regla mientras cargan las alternativas. |
| Valores precargados | Mostrar su procedencia y permitir confirmar el grupo. No tomar automáticamente los valores iniciales del código como decisiones del cliente. |
| Editar una respuesta | Abrir ese bloque y conservar las respuestas posteriores compatibles. Al terminar, volver al primer bloque pendiente o al resumen si todo sigue válido. |
| Cambio que afecta dependencias | Revalidar los descendientes afectados. Marcar solo los incompatibles como pendientes; explicar qué cambió. Conservar archivos y texto independientes. |
| Atrás | Volver a la decisión anterior conservando lo ingresado; no reiniciar el recorrido. |
| Carga, error o falta de disponibilidad | Mantener el bloque activo, informar el motivo y ofrecer reintento. No desbloquear con datos incompletos ni cambiar de variante silenciosamente. |
| Precio | Antes de resolver la variante, indicar «Desde» o «Por confirmar». Con variante válida, mostrar precio exacto y desglose; recalcular extras, despacho y descuentos cuando cambien sus dependencias. |
| Envío final | Resumen revisable y CTA que nombre la acción real. Mostrar espera, impedir duplicados y conservar datos si falla. |

El resumen acumulado es la memoria visual. Debe distinguirse de persistencia: «Selección lista» para estado del recorrido, «Borrador guardado en este dispositivo» solo tras escritura local exitosa y «Guardado en tu cuenta» solo tras confirmación remota. No subir archivos ni crear pedidos por completar una tarjeta. Mantener las políticas actuales de archivos y definir explícitamente qué borradores adicionales se conservarán; no guardar contraseñas ni introducir almacenamiento de datos bancarios.

Ejemplo del estudio:

1. **Producto** abierto; modelo, talla, color y ubicación pendientes.
2. Elegir Polera unisex deja **✓ Producto: Polera unisex · Editar** y abre Modelo.
3. Elegir Básica deja **✓ Modelo: Básica · Editar** y abre Talla.
4. Elegir Mediana deja **✓ Talla: Mediana · Editar** y abre Color; si solo existe Beige, lo muestra como dato resuelto.
5. Elegir Frente deja **✓ Ubicación: Frente · Editar**. El diseño de catálogo permanece visible y bloqueado.
6. Se habilita «Revisar selección» o «Continuar · Foto de tu mascota», según el recorrido.

## Inventario y tratamiento

P0: recorrido público principal. P1: resto de venta y solicitudes públicas. P2: administración. P3: mejoras de edición y configuración.

| ID | Formulario o recorrido real | Tratamiento y secuencia propuesta | Prioridad | Referencia |
| --- | --- | --- | --- | --- |
| F01 | Estudio: diseño de catálogo | Producto → modelo si aplica → talla/edad → color → ubicación → resumen. Diseño elegido siempre visible. | P0 | `main.js`: `renderStep`, `DETAIL_BLOCK_ORDER` |
| F02 | Estudio: traer mi diseño | Producto → modelo → talla/edad → color → ubicación → archivo por cara → revisión técnica → resumen. Revisión técnica dentro del bloque, sin nueva etapa general. | P0 | `main.js`: `renderStep`, `uploadCardHtml`, envío de `design-form` |
| F03 | Estudio: personalizar con mascota | F01 → foto → nombre/notas opcionales → contacto → revisión → enviar solicitud. Con WhatsApp, la foto queda como tarea a realizar en el chat. | P0 | `main.js`, `pet-personalization.js` |
| F04 | Variantes del estudio: tote, mujer, niños, body | Compartir el motor F01–F03. Omitir modelo sin alternativas; adaptar talla a edad y tela fija a dato resuelto. Body sin precio permanece no comprable. No crear asistentes separados por producto. | P0 | `main.js`: familias, variantes y render de Detalles |
| F05 | Checkout: Datos y pago | Contacto precargado o editable → despacho/retiro → región → comuna → dirección si despacho → cálculo → revisión de total → método de pago → confirmación. Cupón y datos adicionales bajo controles opcionales. | P1 | `main.js`: `fulfillmentDetailsHtml`, `renderStep`, `openMercadoPagoCheckout` |
| F06 | Tengo una idea | Idea → referencias opcionales con «Omitir» → contacto → revisión → enviar. No pedir producto/precio antes de la propuesta. | P1 | `main.js`: rama `state.mode === 'custom'` |
| F07 | Compra o solicitud por WhatsApp | Reutilizar las decisiones del recorrido de origen → contacto → resumen → abrir WhatsApp. Explicar los archivos pendientes de adjuntar; abrir el chat no significa solicitud enviada. | P1 | `main.js`: contacto WhatsApp y canal de compra; `pet-personalization.js` |
| F08 | Mi cuenta: Mis datos | Edición por secciones: información personal y dirección. Resumen visible de ambas; edición de una sección a la vez; región → comuna en dirección. No forzar un asistente completo para cambiar un teléfono. | P3 | `main.js`: `account-data-form` |
| F09 | Administración: crear/editar diseño | Colección e identidad → productos vinculados → archivo por producto → color de muestra/colores cuando corresponda → mockups opcionales → comportamiento y publicación → revisión. | P2 | `admin.js`: `design-form` |
| F10 | Administración: pedido manual | Comprador/canal → entrega → productos, uno por uno → tipo/datos de pago pertinentes → observaciones opcionales → revisión → registrar. | P2 | `admin.js`: `manual-order-form` |
| F11 | Administración: editar pedido | Resúmenes de cliente, entrega, productos y notas; editar un bloque y revisar diferencias antes de guardar. No repetir el alta completa. | P2 | `admin.js`: `edit-order-form` |
| F12 | Administración: gestionar insumos | Acción → principal/secundario cuando aplique → búsqueda y elección si editar → formulario. La acción Categorías abre directamente su gestión pertinente. Ya existe revelación parcial; completar secuencia y memoria. | P2 | `admin-supplier-products.js`: `supplier-workflow-dialog` |
| F13 | Administración: crear/editar insumo | Categoría e identidad → compra/costo → cantidad/unidad si pack → dimensiones si DTF → producción/margen/IVA si principal → revisión. Preservar cálculo de costo visible. | P2 | `admin-supplier-products.js`: `supplier-product-form` |
| F14 | Administración: receta de costo | Agregar componente → elegir insumo → cantidad/rendimiento → confirmar línea. Líneas anteriores visibles/editables y total acumulado. | P2 | `admin-supplier-products.js`: `supplier-recipe-dialog` |
| F15 | Administración: colección | Producto → categoría compatible → identidad → orden/visibilidad → revisión. Slug y orden bajo «Opciones avanzadas». | P2 | `admin.js`: `collection-form` |
| F16 | Administración: producto del menú | Nombre/descripción → método de compra heredado o excepción → opciones avanzadas de slug, orden y visibilidad. Revelación por secciones, sin un paso por cada campo corto. | P3 | `admin.js`: `product-form` |
| F17 | Administración: cupón | Código y tipo → valor con unidad correspondiente → restricciones opcionales → vigencia → resumen de condiciones. | P2 | `admin.js`: `coupon-form` |
| F18 | Administración: instrucciones de pago | Habilitar transferencia o enlace según opciones actuales → revelar únicamente campos asociados → resumen → guardar. Mantener autenticación de esta edición. | P2 | `admin.js`: `payment-instructions-form` |
| F19 | Administración: configuración | Mantener bloques independientes. Revelar texto al activar aviso, destinatario al activar notificaciones y excepciones al elegir canal por producto. Selección hero con contador 1/3, 2/3, 3/3; resúmenes y guardado por formulario existente. | P3 | `admin.js`: formularios de tienda/notificaciones y selección hero |

### Formularios revisados que no necesitan un asistente secuencial

| Formulario/control | Decisión |
| --- | --- |
| Login público y administrativo, registro, recuperar contraseña, contraseña nueva, reenviar confirmación | Mantener juntos sus pocos campos relacionados; validación clara y estado de envío. No almacenar contraseña en borradores. |
| Elección de ruta creativa y acceso desde el carro | Ya son decisiones breves; deben conservar contexto al abrir su recorrido, sin añadir pasos intermedios. |
| Categoría de catálogo; crear/renombrar categoría de insumos; mover un insumo de categoría | Edición directa. Opciones técnicas secundarias plegadas si corresponde. |
| Editar/publicar precio | Importe, margen e IVA juntos para decidir con contexto; conservar confirmación de publicación. |
| Cotización creativa | Mensaje y monto juntos, con revisión antes de enviar; no separar artificialmente dos campos relacionados. |
| Tipo de pedido, reautenticación para editar pagos, confirmaciones destructivas | Mantener una acción explícita y su contexto completo. |
| Cupón en checkout, cantidades del carro, filtros/búsquedas, guía de tallas y controles del visor | Controles locales/contextuales; no son recorridos para convertir a asistentes. |
| Formularios de costos anteriores y vincular variantes | Verificar uso antes de intervenir: coexisten implementaciones anteriores con la gestión actual; la vista vigente elimina la interfaz de vinculación de variantes. No migrar código sin acceso activo. |

## Modelo técnico de trabajo

Motor compartido con configuración por recorrido; datos separados de la presentación. No usar únicamente ocultamiento CSS sobre el formulario actual.

| Pieza | Definición |
| --- | --- |
| Esquema de pasos | Cada decisión declara `id`, aplicabilidad, dependencias, validación y generador de resumen. |
| Estado | Separar valores, decisiones confirmadas y bloque activo. Estados: pendiente, activo, completo, requiere revisión y no aplica. Carga y error acompañan al bloque. |
| Transiciones | Seleccionar, continuar, editar, volver, invalidar dependencias, restaurar borrador y reintentar. Un valor inicial no marca el paso como completo. |
| Dependencias | Producto/modelo → talla → color/variante; ubicación → archivos requeridos; modalidad → dirección; región → comuna; selección/carro → precio/cotización/cupón. Revalidar según reglas vigentes, sin inventar restricciones nuevas. |
| Render | Un componente de bloque activo y uno de resumen reutilizables. Actualizar lo necesario sin perder inputs, referencias a archivos, visor, foco o scroll. |
| Guardado | Mantener políticas existentes; incorporar versión del borrador si se persisten decisiones. Revalidar precio y disponibilidad al restaurar. Definir por recorrido si el cierre conserva el borrador y cómo eliminarlo. |
| Accesibilidad | Encabezados y etiquetas visibles; `fieldset/legend`; controles de expansión con `aria-expanded`/`aria-controls`; progreso con `aria-current`; estado anunciado sin repetir todo el resumen. Los campos futuros no participan de foco ni validación hasta activarse. |
| Movimiento y foco | Al avanzar, enfocar el encabezado del siguiente bloque sin salto al inicio del modal. Scroll solo para hacerlo visible. Al expandir manualmente, conservar foco en su control. Respetar movimiento reducido y transiciones del DS. |

## Plan de ejecución

Una entrega es un cambio pequeño verificable. Antes de integrar el patrón en formularios reales, construir y evaluar la muestra aislada descrita abajo. Primero se termina el recorrido de las capturas; luego se reutiliza el patrón. Los esfuerzos son relativos, no fechas comprometidas.

| Orden | Entrega | Trabajo concreto | Dependencia | Esfuerzo | Criterio de aceptación |
| --- | --- | --- | --- | --- | --- |
| 1 | Matriz de estados | Confirmar entradas y ramas activas; mapear preselecciones, dependencias, conservación de archivos y guardado real. Registrar escenarios de catálogo, propio, mascota, tote, body y canal de compra. | — | S | Cada rama tiene inicio, decisiones, resumen, edición, error y resultado definidos. |
| 1A | Sample de evaluación previo | Construir una demo local aislada del formulario de las capturas, con datos ficticios y escenarios reproducibles. Presentar enlace local, capturas y resultados para evaluar antes de aplicar. | 1 | M | Cumple la matriz de evaluación; muestra concreta revisada por el usuario antes de integrar en la tienda. |
| 2 | Patrón en DS | Añadir espécimen de bloque pendiente/activo/completo/revisión; resumen editable y precio. Documentar el patrón en `docs/design-system.md` y catálogo ejecutable. | 1A evaluada y aceptada | M | Funciona en claro/oscuro, móvil y teclado con combinaciones oficiales. |
| 3 | Motor de decisiones | Implementar esquema y transiciones compartidas, validadores y adaptación del borrador existente. Añadir pruebas de dependencia, restauración y edición. | 1–2 | M | Una edición invalida solo descendientes incompatibles y conserva el resto. |
| 4 | Piloto: catálogo | Aplicar F01 y F04 al primer paso del estudio; conservar visor, precio exacto y resumen general. | 3 | M | Producto → modelo → talla → color → ubicación aparecen de a uno; cada respuesta queda visible y editable. |
| 5 | Archivos y mascota | Extender a F02–F03: archivos por cara, validación/optimización, opcionales y contacto. | 4 | M | Subir, reemplazar, fallar o volver no borra elecciones ni archivos independientes. |
| 6 | Idea y WhatsApp | Aplicar F06–F07; conservar diferencias de canal y revisar antes de enviar/abrir chat. | 5 | M | No se pide cargar en web un archivo que debe adjuntarse en WhatsApp; CTA y estado describen el resultado real. |
| 7 | Checkout | Aplicar F05 y edición contextual F08; separar cotización de confirmación de pago. | 3–6 | L | Retiro omite dirección; despacho respeta región/comuna; cambios recalculan lo necesario; falla de pago conserva el carro. |
| 8 | Catálogo administrativo | Migrar F09, F15 y F17, empezando por altas; edición por resúmenes. | 3 y piloto aceptado | L | Producto/archivo/color y descuentos conservan sus validaciones; publicación requiere confirmación explícita. |
| 9 | Pedidos y pagos administrativos | Migrar F10–F11 y F18; revisar diferencias y mantener autenticación y permisos existentes. | 8 | L | Navegar decisiones no crea pedidos, envía mensajes ni registra pagos. |
| 10 | Insumos y configuración | Completar F12–F14, F16 y F19; revisar y excluir accesos antiguos sin uso. | 8 | L | Costo, receta y opciones dependientes mantienen coherencia y guardado explícito. |
| 11 | Verificación integral | Recorrer matriz, corregir problemas de foco/scroll y documentar el resultado. Verificar cada entrega y cerrar con regresión completa. | 4–10 | M | Pasan los controles siguientes y no quedan recorridos activos del inventario sin tratamiento. |

S = acotado; M = varios estados o una integración; L = varios recorridos con dependencias. Ajustar duración después del piloto, con evidencia del motor y render actual.

## Sample de evaluación antes de aplicar

**Primera entrega revisable: demo funcional aislada de Detalles**, inspirada en las capturas. Construida en `samples/progressive-disclosure.html`, disponible mediante Vite en `/samples/progressive-disclosure.html`. Esta sección conserva el alcance y criterios de evaluación; los resultados están en el [informe de la muestra](evaluations/progressive-disclosure.md). La demo no modifica formularios de producción, no consulta datos privados, no sube imágenes y no crea solicitudes ni pagos. Usa un estado mínimo propio para comprobar la interacción antes de desarrollar el motor compartido definitivo.

### Alcance y datos de muestra

- Una página local independiente, propuesta en `/samples/progressive-disclosure.html`, con estilos y tokens del DS existente. Controles de escenarios claramente separados de la interfaz del cliente.
- Diseño de ejemplo «La Playera» como contexto fijo. Recorrido: Producto → Modelo → Talla → Color → Ubicación → resumen → simulación de Foto de tu mascota.
- Fixture sintética: Polera unisex, Básica, Mediana, Beige y Frente; precio de ejemplo $15.990, rotulado como demostración. Incluir una segunda combinación para probar cambios de modelo y talla incompatible, además de escenarios sin disponibilidad y carga fallida. No presentar estos datos como catálogo vigente.
- Una versión de referencia con todos los controles expuestos y otra progresiva, ambas con los mismos datos, para comparar la experiencia sin diferencias de contenido.
- Botones de evaluación para reiniciar, simular error de carga, cambiar disponibilidad y restaurar un borrador ficticio. Ningún evento del sample debe abrir WhatsApp ni iniciar un envío real.

### Muestra de lo que debe poder revisarse

| Momento | Vista esperada | Acción de evaluación |
| --- | --- | --- |
| Inicio | Contexto «La Playera», Producto abierto y títulos pendientes debajo. Precio «Desde $15.990 · Demostración». | Elegir Polera unisex. |
| Primera selección | «✓ Producto: Polera unisex · Editar»; Modelo abierto. | Elegir Básica. |
| Talla | Producto y modelo resumidos; Talla abierta. | Elegir Mediana. |
| Color único | «✓ Talla: Mediana · Editar» y «Color: Beige · Única opción»; Ubicación abierta. | Elegir Frente. |
| Configuración lista | Todos los resúmenes editables, precio de muestra exacto y CTA «Continuar · Foto de tu mascota». | Editar Talla y comprobar qué se conserva. |
| Cambio incompatible | Explicación junto al dato afectado y primer bloque pendiente abierto; contexto y decisiones compatibles conservados. | Completar la nueva combinación y revisar el resumen. |
| Continuación | Foto de tu mascota simulada; resumen de la prenda disponible y acción Volver. | Volver sin perder la configuración. |

### Matriz de evaluación

| Caso | Procedimiento | Condición para pasar |
| --- | --- | --- |
| E01 · Secuencia | Completar el recorrido desde cero. | Un solo bloque de edición activo; siguiente bloque visible; cada elección completada deja un resumen. |
| E02 · Preselección | Abrir con valores iniciales y luego con borrador ficticio. | Los valores iniciales no confirman decisiones; el borrador se identifica y revalida antes de continuar. |
| E03 · Única opción | Usar fixture con un solo color. | Beige se muestra como dato resuelto después de resolver la talla; no hay clic obligatorio ni autoavance durante la carga. |
| E04 · Edición compatible | Cambiar talla a una combinación compatible. | Conservar color y ubicación válidos; actualizar resumen y precio sin reiniciar el flujo. |
| E05 · Dependencia incompatible | Cambiar modelo a otro sin la talla elegida. | Marcar la talla para revisar, abrir la primera decisión afectada y conservar lo independiente. |
| E06 · Error y disponibilidad | Simular fallo, reintentar y después quitar variantes. | Error explicado, reintento útil y avance bloqueado si no existe variante válida. |
| E07 · Teclado y foco | Completar y editar usando solo teclado. | Sin trampas de foco; flechas no disparan avance; activación explícita avanza; foco y posición del siguiente bloque son previsibles. |
| E08 · Responsive y movimiento | Revisar 360, 768 y 1440 px; claro/oscuro y movimiento reducido. | Sin desbordes horizontales del formulario, controles cortados ni saltos al inicio; etiquetas y resúmenes legibles. |
| E09 · Resumen y retorno | Continuar al paso simulado y volver. | Producto, modelo, talla, color, ubicación y precio coinciden; no se pierden selecciones. |
| E10 · Guardado comunicado | Completar, restaurar y reiniciar la demo. | El mensaje distingue selección, borrador ficticio y reinicio; nunca afirma guardado remoto. |

Son criterios de aceptación propuestos para este proyecto. Registrar cada caso como Pendiente, Pasa o Falla, con evidencia y observación; no rellenar resultados hasta ejecutar la demo.

### Evaluación del modelo GPT sobre el sample

Usar **Sol · Alto** como candidato inicial. Si se desea contrastar con **Astra · Alto**, darles el mismo brief, DS, fixture, revisión base del repositorio y alcance, en copias aisladas. No comparar candidatos que partan del trabajo del otro. Esta comparación es opcional y no implica iniciar dos agentes ahora.

Evaluar ambos con E01–E10 antes de considerar tiempo o consumo. Registrar modelo, esfuerzo, revisión base, tiempo observado, consumo si está disponible, casos aprobados y correcciones necesarias. Si ambos cumplen, preferir el que requiera menos recursos y retrabajo. No asumir que el modelo recomendado ya ganó una evaluación que todavía no se ha realizado.

### Condición para aplicar al resto

Entregar demo navegable, capturas del inicio/avance/edición/resumen, tabla E01–E10 completada y problemas pendientes. La muestra pasa técnicamente cuando todos los casos cumplen y no hay pérdida de datos, precio incorrecto, avance inválido ni bloqueo de teclado. Después, presentar el resultado concreto para revisión del usuario: **la aplicación a los formularios reales queda pendiente de su aceptación de la muestra**, solicitada aquí como parte de la evaluación previa. Una vez aceptada, continuar desde la entrega 2 y mantener los casos como referencia de regresión.

## Avance de implementación

- Muestra 1A: aprobada visualmente por el usuario («está perfecto»); la instrucción posterior «sigue» autoriza continuar.
- Entregas 2–3: primitive compartido, motor de confirmaciones/dependencias y espécimen ejecutable en DS implementados.
- Entrega 4: Detalles usa la secuencia para todos los productos disponibles y canales. Conserva visor, precio, variantes y la navegación general.
- Entregas 5–6: foto e indicaciones de mascota, contacto de solicitud, Tengo una idea y contacto de compra WhatsApp integrados con bloques confirmables y revisión previa.
- Entrega 7: checkout integrado con contacto, modalidad, región, comuna y dirección; retiro omite dirección y las opciones secundarias se pliegan. Mis datos integrado como edición por secciones, sin forzar una secuencia de alta; probado con perfiles ficticios.
- Catálogo administrativo: F09 (diseño), F15 (colección) y F16 (producto) integrados localmente con confirmación por bloques, revisión y serialización de campos plegados. Ver [evaluación administrativa](evaluations/admin-form-flows.md).
- Pedidos administrativos: F10 (alta manual) y F11 (edición por secciones) integrados localmente; [evaluación de pedidos](evaluations/order-form-flows.md).
- Insumos: F12 (gestión), F13 (formulario) y F14 (receta) integrados localmente con campos aplicables, resúmenes y retorno del borrador al crear un componente. Ver [evaluación de insumos](evaluations/supplier-form-flows.md).
- Pendientes: F17–F19 (cupones, instrucciones de pago y configuración) y entrega 11 (verificación integral de todas las ramas). Los controladores públicos tienen evaluación local; el recorrido completo de checkout y mascota desde el catálogo requiere datos remotos disponibles. No se declara finalizado el inventario F01–F19.
- Validación de Detalles en [el primer informe](evaluations/progressive-disclosure-integration.md); validación de solicitudes/contacto/checkout en [la evaluación de formularios públicos](evaluations/public-form-flows.md).

## Modelo GPT recomendado por entrega

Recomendación para ejecutar este trabajo en Codex: **GPT-6.1 Sol con razonamiento alto** como modelo principal. La asignación siguiente es una recomendación para este repositorio, no una medición comparativa realizada sobre él. Los identificadores están disponibles en el catálogo de herramientas de esta sesión; esta propuesta no cambia el modelo de la conversación ni inicia agentes adicionales.

| Entregas | Trabajo | Modelo recomendado | Razonamiento | Motivo de la asignación |
| --- | --- | --- | --- | --- |
| 1 | Matriz de estados y dependencias | GPT-6.1 Sol | Alto | Entender las ramas existentes y convertirlas en reglas verificables. |
| 1A | Sample aislado y evaluación previa | GPT-6.1 Sol | Alto | Probar la experiencia completa en pequeño antes de extender el patrón; comparación opcional con Astra alto usando el mismo alcance. |
| 2 | Patrón visual y accesibilidad en DS | GPT-6.1 Sol | Alto | Coordinar componentes, estados, foco y responsive con el sistema existente. |
| 3 | Motor compartido y borradores | GPT-6.1 Sol | Alto | Concentrar el razonamiento en transiciones, invalidación y conservación de datos. |
| 4–6 | Estudio, archivos, mascota, idea y WhatsApp | GPT-6.1 Sol | Alto | Integrar varias rutas sin perder estado ni alterar su resultado comercial. |
| 7 | Checkout | GPT-6.1 Sol | Alto | Revisar dependencias entre contacto, entrega, cotización y pago. |
| 8–10 | Formularios administrativos | GPT-6.1 Sol | Medio; alto si aparecen dependencias nuevas | Aplicar el patrón validado y aumentar esfuerzo donde exista lógica de negocio compleja. |
| 11 | Revisión integral y diagnóstico de regresiones complejas | GPT-6 Astra | Alto | Segunda revisión centrada en fallos de interacción y coherencia entre recorridos. Se puede realizar con Sol alto si se prefiere un solo modelo. |
| Apoyo acotado | Textos, documentación y ajustes mecánicos con alcance cerrado | GPT-6 Luna | Medio | Reservar un modelo eficiente para tareas claramente delimitadas y verificables. |

Si se usa un solo modelo para todo el trabajo: **GPT-6.1 Sol · Alto**. No empezar con esfuerzo máximo: subirlo solo ante un problema concreto que no se resuelva con el nivel previsto. Cambiar de modelo no reemplaza las pruebas ni la revisión visual.

Base consultada el 19 de octubre de 2026: [selección de modelos de OpenAI](https://developers.openai.com/api/docs/guides/model-selection) y [criterios de modelo y esfuerzo de razonamiento](https://developers.openai.com/api/docs/guides/deployment-checklist). OpenAI sitúa Sol en trabajo técnico complejo, Astra en tareas de mayor exigencia y Luna en trabajo eficiente y repetible; la distribución por entrega es una adaptación a este plan.

## Verificación y definición de terminado

- Pruebas del motor: no avanzar sin confirmación/validez, opción única, cambio de producto, invalidez parcial, edición hacia atrás, restauración y envío duplicado.
- Recorridos: catálogo, archivo propio frontal/doble cara, mascota, idea, tote y producto sin precio; carrito/WhatsApp; invitado/cuenta; retiro/despacho; cupón; cargas y errores recuperables. Probar fallos con mecanismos de prueba, sin enviar solicitudes ni cobros reales.
- Interfaz: móvil estrecho, tablet y escritorio; modo claro/oscuro; teclado completo; lector de pantalla para avance y error; zoom y movimiento reducido. Mantener el siguiente bloque visible sin saltos al inicio.
- En las entregas de implementación: `npm test` y `npm run build`; `npm run audit:a11y-colors` cuando cambien colores. Añadir cobertura del comportamiento nuevo, no pruebas que solo comparen HTML.
- Cada decisión completada conserva respuesta y acción Editar. No hay campos requeridos ocultos bloqueando el envío. El resumen final coincide con archivos, variante, precio y canal efectivos.
- Medir, si se instrumenta analítica, avance/abandono por decisión, retrocesos y errores sin capturar datos personales. Comparar antes/después; no inventar una mejora porcentual sin medición.

Este documento propone el patrón. Las reglas vigentes del DS se actualizan junto con su implementación y espécimen, para no documentar como disponible una interfaz que aún no existe.
