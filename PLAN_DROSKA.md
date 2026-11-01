# Plan maestro de implementación de Droska

Fecha de análisis: 13 de octubre de 2026 (America/Santiago). Estado actualizado el 14 de octubre: **I01–I03 e I05–I11 implementadas; I04 sigue bloqueada por datos comerciales de Body; la aceptación visual y la prueba real de compra siguen pendientes.** La tienda, la migración editorial y dos funciones de pedido ya están publicadas; el estado operativo figura en §6.

# Índice del research plan

1. [Diagnóstico de arquitectura](#1-diagnóstico-de-arquitectura)
2. [Matriz de requerimientos](#2-matriz-de-requerimientos)
3. [Roadmap de implementación](#3-roadmap-de-implementación)
4. [Plan de ejecución y contratos compartidos](#4-plan-de-ejecución-y-contratos-compartidos)
5. [Recomendación de modelos y ahorro](#5-recomendación-de-modelos-y-ahorro)
6. [Riesgos, regresiones y decisiones pendientes](#6-riesgos-regresiones-y-decisiones-pendientes)
7. [Checklist de validación final](#7-checklist-de-validación-final-t14)
8. [Primera intervención](#8-primera-intervención)

## Contenido

## 1. Diagnóstico de arquitectura

### Alcance y evidencia

Se inspeccionó el árbol de trabajo real, incluidos cambios locales existentes. El repositorio ya tenía modificaciones y archivos sin seguimiento en catálogo, estudio, tote, Mujer y migraciones: son la base de este diagnóstico y no deben revertirse. README y DS contienen algunas descripciones anteriores al código actual. Ante discrepancias, este documento distingue código comprobado, intención de producto y datos pendientes de verificar.

Por instrucción del usuario, **no se hicieron revisiones visuales, capturas ni navegación del sitio**. Esta restricción se traslada a los prompts: el usuario realiza la aceptación visual. Tampoco se consultó una cuenta administrativa, se inspeccionaron datos privados ni se ejecutaron migraciones o despliegues. Las consultas públicas del build fallaron; no se pueden confirmar precios, variantes, archivos concretos ni migraciones aplicadas en producción. No se investigaron imágenes de referencia en esta etapa; las referencias de prendas siguen siendo un entregable de I07, con revisión visual a cargo del usuario.

### Stack y puntos de entrada comprobados

| Capa | Implementación real | Consecuencia para el plan |
| --- | --- | --- |
| Interfaz | JavaScript ESM y DOM nativo; Vite `^7.1.0`, sin framework de componentes | Reutilizar funciones y markup; no migrar a React ni introducir un estado global nuevo |
| Tienda | `index.html`, `src/main.js`, `src/style.css` | `main.js` concentra estado, catálogo, modales, archivos, carro y checkout; limitar ediciones a funciones señaladas |
| Administración | `admin.html`, `src/admin.js`, `src/admin-supplier-products.js`, `src/admin.css` | SPA propia por hash con formularios, consultas Supabase y comprobación de membresía administrativa |
| Catálogo | `src/catalog.js`, `src/product-navigation.js`, `src/catalog-product-artworks.js` | Carga y normalización reutilizables; este último reexporta el contrato compartido con servidor |
| Páginas SEO | `catalog-page.html`, `src/catalog-page.js`, `src/catalog-page-render.js`, `src/catalog-routes.js`, `scripts/generate-catalog-pages.mjs` | Hay dos recorridos: modal comercial y HTML indexable; verificar ambos |
| Backend | Supabase/Postgres, Auth, RLS, Storage, Edge Functions Deno; cliente `@supabase/supabase-js ^2.98.0` | Cambios persistentes requieren migración y validación del servidor; no confiar en restricciones de UI |
| 3D | Three.js `^0.180.0`, OrbitControls, GLTFLoader, DecalGeometry | Mantener tecnología, carga diferida y ciclo de liberación de recursos |
| Archivos | `src/design-storage.js`, `tus-js-client 4.3.1`, IndexedDB y Storage | Reutilizar carga privada; conservar original separado de preview |
| Pruebas | `node --test src/*.test.js`, build Vite + generación SEO, auditoría de contraste | No hay un runner E2E declarado en `package.json`; no inventar comandos ni instalarlo por defecto |
| Publicación SEO | `api/rebuild-catalog.js`, llamada administrativa y Deploy Hook | Reutilizar regeneración; ordenar y propagar metadata tanto en runtime como en build |
| Diseño | `docs/design-system.md`, `src/design-system.css`, `design-system.html` | Tokens, primitives, foco visible, etiquetas y pares oficiales WCAG 2.0 AA |

### Modelo comercial: entidades que no deben confundirse

- **Familia del catálogo:** `catalog_product_types`, con slug, visibilidad y orden. No es un modelo ni una categoría de insumo.
- **Jerarquía editorial:** `catalog_categories` → `catalog_collections` → `catalog_designs`. La colección conserva `product_type_id`, `category_id` y `sort_order`; el diseño conserva `collection_id`.
- **Productos comprables:** `product_models` y `product_variants`. La variante contiene `size`, `color_name`, `color_hex`, `price_clp`, `active` y SKU. Los identificadores actuales incluyen `basic`, `over`, `woman`, `kid`, `body` y `tote`; en el frontend se usa `kids`, convertido a `kid` en parte del backend.
- **Familias del selector:** `productFamilies` en `main.js`: Hombre, Mujer, Niños, Tote bag. Son agrupaciones de modelos, no nuevas tablas. `products` mantiene precios locales y tallas, actualizados parcialmente por `loadProductPrices()`.
- **Insumos:** `supplier_categories`, `supplier_products`, recetas y precios confirmados. También existen `supplier_costs` y `supplier_product_variants`. Atención: el camino activo `supplierProductVariants()` llama a `compatibleVariants()` y la vista actual elimina la vinculación manual; la existencia de la tabla no demuestra que sea la fuente efectiva del panel actual.
- **Recursos:** `catalog_designs.product_artworks` es un mapa por slug de producto; `artwork_path` mantiene compatibilidad. `mockup_path` y `mockup_hover_path` son fotos editoriales. `sample_color` es un color de muestra único, no una lista de colores permitidos.
- **Pedidos:** `orders`, `order_items`; el servidor calcula importes y guarda SKU, color y `catalog_artwork_path`. `create-payment-preference` y `create-demo-order` deben coincidir en producto, talla, color, cara y archivo.

### Flujos y componentes reutilizables

1. `beginIdea()` → `resetIdea()` → `openStudio('choose')` muestra **“¿Qué tienes hoy?”** dentro del mismo `#studio`. No es necesario crear otro modal. `renderStep()` ofrece `ready` (archivo listo) y `custom` (solicitud creativa con referencias).
2. Catálogo: `catalogDesignCard()`, `openCatalogCollection()`, `openCatalogDesign()` y `chooseCatalogDesign()`; enlaces compartidos y SEO también terminan en ese recorrido.
3. `chooseCatalogDesign()` carga el arte del producto y configura `catalogDesign`/`catalogDesignSlug`. Esos campos también bloquean la edición y provocan que checkout omita subir originales. **No sirven sin cambios para representar una foto del cliente asociada a una plantilla.**
4. `state` en `main.js` conserva modelo, talla, color, caras, imágenes, archivos, revisión, diseño y pasos. `persistDraft()`, localStorage e IndexedDB conservan partes del recorrido; verificar explícitamente el nuevo contexto al restaurar o editar el carro.
5. `upload()`, `addReferenceFiles()` y `uploadPrivateDesign()` cubren imagen lista y referencias creativas. Reutilizar validación JPG/PNG/WebP, decodificación y límite de 50 MB. No añadir transformación automática de mascota, IA generativa ni cobros creativos nuevos.
6. `previewState()`, `syncPreview()`, `faceSelectedSide()` administran los visores. `src/garment.js` usa `public/shirt.glb`; `src/garment-cuts.js` deriva oversize y niños. `woman` no tiene rama geométrica propia y conserva la base.
7. `src/tote-viewer.js` genera cuerpo y asas de forma procedural, con `toteSurface()`, `createToteGeometry()`, `createToteHandleGeometry()` y `createToteViewer()`. La impresión sigue `toteSurface`; cambiar solo el cuerpo puede separar el arte de la tela.
8. `src/viewer.js` contiene otro visor, pero no es el import dinámico usado por el estudio actual. No modificarlo por similitud de nombre.

### Hallazgos que cambian la implementación

| Hallazgo comprobado | Implicación |
| --- | --- |
| `product_artworks` y snapshot del pedido ya existen; hay pruebas de correspondencia | T5 es una corrección de integración, no un sistema nuevo de imágenes |
| `[data-product-family]` cambia `state.kind` sin recargar arte; `[data-product]` sí lo recarga | Unificar esa transición concreta y proteger cambios rápidos contra respuestas atrasadas |
| `loadProductPrices()` no solicita colores; el estudio repite cuatro swatches y bloquea catálogo | T2 y T11 requieren un solo contrato de disponibilidad para admin, selector y servidor |
| Los mapas del servidor usan modelo:talla, sin color | Habilitar multicolor sin corregir resolución de variantes puede asociar precio/SKU incorrectos |
| `body` se crea en `20260928090000_supplier_pricing.sql`; `bodys` es categoría de insumos | No crear otro modelo; faltan integración pública y verificación de variantes/precios reales |
| `compatibleVariants()` reconoce edades en años y tamaños S/M/L, no discrimina rangos de meses | Publicar un precio de body podría afectar varias tallas; corregir esta asociación dentro de T4 |
| Colecciones se ordenan por `sort_order`/nombre y diseños por fecha descendente; SEO consulta diseños por `id` | Destacados exige criterio compartido y preservar el orden restante, incluida la portada de colección |
| `featuredPhoto` significa foto editorial | No reutilizarlo como indicador comercial de destacado |
| El paso Detalles ya tiene Producto y Modelo, pero Color antecede a Talla | Reordenar y hacer progresiva la misma pantalla; no crear cinco pantallas obligatorias |
| Tote ya limita sus caras a Frente en `includedSides()`/`setPrintSides()` y servidor | Conservar la restricción y cerrar bypass por borradores; la espalda sigue siendo explorable en 3D |
| `renderStep()` reemplaza `#step-content` y vuelve a enlazar controles | Candidato al salto de scroll/foco; **causa en navegador no reproducida**. No afirmar que basta con quitar un `scrollIntoView` |
| `checkoutScrollSnapshot` y `scrollIntoView` existen en cálculo de despacho | Separar scroll de configuración y navegación intencional de checkout |
| Tote apunta cámara/target a y=.54 y el arte se centra aproximadamente en y=-.11 | Ajustar todos los puntos de entrada de cámara, incluidos `face()` y `reset()`, no solo la inicialización |
| DS pide tote casi plana y menciona Frente/Espalda | T7 y T9 del usuario reemplazan esas reglas: actualizar DS al implementarlas, sin aprobación adicional por la contradicción |

### Línea base técnica ejecutada

- `npm test`: **84/84 aprobadas**, sin fallos ni omisiones.
- `npm run build`: **aprobado**. Aviso preexistente de chunk superior a 500 kB; no optimizar bundling dentro de estas tareas.
- Generación SEO: **16 páginas usando respaldo local**, por `TypeError: fetch failed` al consultar Supabase. No prueba el catálogo remoto ni sus importes.
- Auditoría de colores no ejecutada en planificación: no se cambian colores. Será obligatoria en intervenciones que los cambien.
- Sin pruebas visuales, E2E en navegador, pagos, emails o escrituras remotas. Los checks existentes no demuestran aceptación de los 14 requisitos.

## 2. Matriz de requerimientos

Prioridad P0 = coherencia del pedido/compra; P1 = selección, comprensión o control comercial; P2 = mejora de exploración. Complejidad relativa, no estimación de horas. Los criterios son futuros: ninguno se marca aprobado por esta planificación.

| ID / nombre | Estado/problema → resultado esperado | Archivos/componentes reales | Dependencias / unidad | Riesgo | Prioridad / complejidad | Aceptación verificable |
| --- | --- | --- | --- | --- | --- | --- |
| T1 · Personalización por foto | Falta configuración; catálogo carga arte fijo → identificar y abrir carga existente conservando colección | `admin.js`, `catalog.js`, `main.js`, `catalog-page-render.js`, generador SEO, ambas funciones de pedido, `create-design-request` | I01 → I02; usa contrato de T2 si restringe colores | Perder foto por clasificación de catálogo; perder diseño de origen al resetear | P0 / alta | Guardar/recargar marca; pill textual; abre “¿Qué tienes hoy?”; foto válida llega al flujo elegido y se conserva; tradicional no cambia |
| T2 · Varios colores | Solo `sample_color` y colores locales → selección múltiple persistente | `admin.js`, `catalog.js`, `main.js`, `product_variants`, funciones de pedido | I01 → I03, junto a T11 | Ofrecer colores sin variante o elegir otro SKU | P0 / alta | Uno/varios colores se guardan; se filtran por producto/modelo/talla; servidor rechaza color inválido |
| T3 · Destacados | Sin prioridad comercial explícita → destacados primero | `admin.js`, `catalog.js`, `main.js`, generador, render SEO | I01 → I02 | Alterar filtros, portada u orden restante | P1 / media | Colecciones y diseños marcables; prioridad en home, filtros, diálogos y SEO; ocultos siguen ocultos; desempate estable |
| T4 · Bodys | Modelo e insumos previstos, sin selector/checkout/3D completo → personalización completa | `admin.js`, `main.js`, `product-navigation.js`, helper compartido de artworks, páginas/generador SEO, funciones de pedido, `garment.js`, `garment-cuts.js` | I04 + I07; colores I03, recursos I05 y precio I06 | Inventar tallas/precios; mezclar meses; body convertido en polera | P0 / alta | Bodys en catálogo y selector; talla/precio real por variante; arte vinculado; pedido y visor de body; cuello, mangas y cierre inferior reconocibles |
| T5 · Arte por producto | Mapa existente con cambio de familia incompleto → recurso correcto siempre | `main.js`, `catalog-product-artworks.js`, `_shared/catalog-product-artworks.js`, `artwork-fit.js`, ambos visores | I05; I04 para completar Body | Carreras async, deformación o fallback al arte de otra familia | P0 / media | Polera usa rectangular y tote cuadrado donde estén cargados; todas las entradas/cambios y pedido concuerdan; sin estirar ni inventar recurso faltante |
| T6 · Polera mujer | Opción `woman` existe, geometría base → corte diferenciado | `garment-cuts.js`, `garment.js`, pruebas de cortes/decal | I07; independiente del backend de colores | Deformar cuello, mangas o área impresa | P1 / alta | Referencia registrada; cintura/torso/hombros/mangas diferenciados; frente/espalda compatibles con impresión y sin cambiar otras prendas |
| T7 · Volumen tote | Dos paneles con poca profundidad → base y laterales textiles | `tote-viewer.js`, `tote-viewer.test.js` | I08 con T8 | Separación de arte, autointersección o costo geométrico | P1 / alta | Base con profundidad y pliegues, M/L coherentes, arte acompaña superficie; aprobación visual del usuario |
| T8 · Encuadre tote | Target favorece altura total → impresión protagonista | `tote-viewer.js`, llamadas `faceSelectedSide()` | I08 con T7 | `face()`/`reset()` deshacen encuadre; recorte móvil | P1 / media | Abrir/restablecer/cambiar cara mantienen objetivo sobre cuerpo; asas pueden recortarse y modelo completo sigue explorable |
| T9 · Secuencia | Color antes de Talla y controles simultáneos → Producto→Modelo→Talla→Color→Diseño y ubicación | `main.js`, `style.css`, DS | I10 tras I03–I06 | Perder selección, crear pasos redundantes, enviar espalda en tote | P0 / media | Orden DOM/teclado coherente; dependientes no interactúan antes; volver conserva elecciones válidas; tote solo Frente |
| T10 · Precios desde | Familias sin precio; defaults locales → mínimo vigente | `main.js` (`loadProductPrices`, familias, `money`) | I06 tras I03/I04 | Publicitar precio de variante no seleccionable o un respaldo como vigente | P0 / baja tras dependencias | Cinco familias muestran “Desde $XX.XXX” desde variantes activas elegibles; actualizar admin se refleja en próxima carga/apertura; sin datos no inventar monto |
| T11 · Sincronizar colores | Selector no consume restricción → continuidad hasta pedido | Mismos que T2; `previewState`, borrador y carro | **Misma I03 que T2**, contrato I01 | Restablecer muestra al cambiar modelo o restaurar carro | P0 / alta compartida | Múltiples colores seleccionables, 3D refleja elección; persiste al avanzar/volver; inválido se explica y reconcilia |
| T12 · Giro inicial | Visores sin introducción breve → interactividad entendible | `main.js`, `garment.js`, `tote-viewer.js` | I09 tras I07/I08 | Repetir en cada render, competir con gesto, movimiento reducido | P2 / media | Giro leve una vez por apertura, se cancela con interacción/cierre; reducido sin giro; sin nuevos loops y fluido en móvil |
| T13 · Scroll | Reporte del usuario; rerender candidato → conservar contexto | `main.js`, `style.css`, `accessibility.css` solo si se demuestra necesario | I10 junto a T9 | Romper foco, despacho o cambios intencionales de paso | P0 / media | Frente/Espalda/talla/color/producto/carga no saltan arriba; foco estable, teclado usable; usuario verifica escritorio/móvil |
| T14 · Validación | Suite parcial sin aceptación integral → recorrido consistente | Tests existentes, contratos y checklist §7 | I11 después de I01–I10 | Confundir tests unitarios/build de respaldo con operación real | P0 / media | Todos los 18 controles originales registrados, evidencia técnica y resultado visual del usuario, sin regresiones críticas pendientes |

## 3. Roadmap de implementación

Se conservan las **cinco fases solicitadas**. T4 se divide entre habilitación comercial en fase 2 y geometría en fase 3. Esto permite implementar y probar datos sin mezclar modelado 3D con precios; **no publicar Bodys como compra completa hasta terminar ambos**.

| Orden | Fase / intervención | Requisitos cubiertos | Dependencias obligatorias | Modelo / razonamiento | Puerta para continuar |
| --- | --- | --- | --- | --- | --- |
| I01 | 1 · Configuración compartida en persistencia y administrador | Contratos T1, T2, T3, T11 | Ninguna; usar árbol actual | `gpt-6.1-sol` / High | Contrato compatible documentado, admin guarda/recarga y migración probada en entorno de prueba |
| I02 | 1 · Entrada por foto, pills y prioridad editorial | T1, T3 completos | I01 | `gpt-6-luna` / Medium | Contexto de diseño + original sobreviven al recorrido; orden compartido comprobado |
| I03 | 1 · Colores y resolución de variantes de extremo a extremo | T2 + T11 completos | I01; I02 para foto de catálogo | `gpt-6.1-sol` / High | UI, carro y ambas funciones resuelven la misma variante/precio; cero selección ambigua |
| I04 | 2 · Integración comercial de Bodys | T4: insumos, catálogo, selector, servidor | I03 | `gpt-6.1-sol` / High | Correspondencia real insumo→talla/variante/precio y familia de catálogo registrada |
| I05 | 2 · Recurso gráfico único por transición de producto | T5; T4 en selección de arte | I04 para Body; T5 base solo requiere contrato actual | `gpt-6-luna` / Medium | Familia/modelo/enlace/carro usan mismo archivo; cambios rápidos seguros |
| I06 | 2 · Precios desde en mini cards | T10 completo | I03/I04 | `gpt-6-luna` / Low | Min de variantes elegibles en las cinco familias; sin valores manuales |
| I07 | 3 · Corte femenino y geometría de body | T6; T4: 3D y referencias | I04 para conectar body; I05 para comprobar estampado | `gpt-6.1-sol` / High | Geometría verificable por código y checklist visual entregado; usuario aprueba proporciones |
| I08 | 3 · Volumen y encuadre de tote | T7 + T8 completos | I05 para comprobar arte aplicado | `gpt-6.1-sol` / High | Superficie e impresión coinciden; cámara consistente y sin pérdida de exploración |
| I09 | 3 · Introducción de giro | T12 completo | I07/I08 | `gpt-6-luna` / Medium | Ciclo/cancelación/reduced motion comprobados; prueba móvil pendiente o aprobada por usuario |
| I10 | 4 · Orden, continuidad de estado y scroll | T9 + T13 completos | I02–I06; ejecutar después de I09 para estabilizar visor | `gpt-6-luna` / Medium | Transiciones correctas y scroll/foco medidos; revisión manual del usuario |
| I11 | 5 · Validación integral | T14 y cierre de T1–T13 | I01–I10 | `gpt-6-luna` / Medium | Checklist completo con evidencia; cualquier pendiente visible impide declarar listo |

### Dependencias frente a agrupaciones

- **Obligatorio:** persistencia antes de consumir metadata; variantes/color antes de anunciar precio y vender; producto `body` antes de enlazar su visor; geometría y cámara estables antes del giro inicial; todo antes de aceptación final.
- **Agrupación recomendada:** T2+T11 comparten la misma política; T7+T8 cambian el mismo visor; T9+T13 cambian el mismo ciclo de render; T1+T3 comparten formularios y propagación de metadata. I07 comparte puntos de integración y pruebas entre prendas, pero cada geometría conserva su identidad.
- I07 e I08 son técnicamente independientes una vez cumplidos sus requisitos. Se recomienda ejecución secuencial por ahorro de contexto y revisión; no se necesitan subagentes.
- I02 e I03 vuelven a `main.js`, pero con responsabilidades separadas: origen de archivo frente a disponibilidad. No unirlas en una reescritura grande del estudio.
- I04/I05/I06 trabajan consecutivamente sobre producto, arte y precio. I06 es deliberadamente pequeña: usa el contrato terminado y puede ejecutarse con modelo económico/Low.

### Estrategia de entrega y reversión

Una intervención por cambio revisable. Registrar archivos, pruebas y decisiones al terminar; no releer todo el repositorio en la siguiente. Preparar migraciones aditivas, sin reescribir migraciones antiguas. Desplegar esquema compatible → servidor que valida contrato → frontend que lo consume. No activar configuraciones nuevas hasta que sus consumidores estén disponibles. Para Bodys, completar I04–I07 y validaciones antes de publicación comercial.

Si falla una entrega: mantener opciones anteriores y desactivar publicación nueva desde controles existentes, conservando datos y pedidos. No eliminar columnas ni archivos de clientes como rollback. Los pedidos históricos conservan sus snapshots; la revalidación de carro antiguo puede exigir nueva selección explícita si una variante dejó de existir. Estos pasos son recomendaciones para ejecución futura, no autorizan cambios remotos en esta planificación.

## 4. Plan de ejecución y contratos compartidos

Los prompts de [docs/droska-tasks/README.md](docs/droska-tasks/README.md) contienen contexto, objetivo, archivos, acciones, restricciones, pruebas y Definition of Done por unidad. La matriz §2 asigna **cada tarea original** a sus unidades; leer solo esas secciones y el prompt correspondiente. Los nombres siguientes describen decisiones propuestas; **no se presentan columnas o módulos nuevos como si ya existieran**. I01 debe registrar nombres finales en esta sección para que las demás intervenciones no los inventen.

### C1 · Configuración editorial y compatibilidad (I01 · implementación técnica lista)

Contrato final: `catalog_collections.is_featured boolean not null default false`; `catalog_designs.accepts_customer_image boolean not null default false`; `catalog_designs.is_featured boolean not null default false`; `catalog_designs.allowed_colors text[] null`. La migración aditiva es `20261014025405_catalog_design_configuration.sql`. Los indicadores editoriales se propagan como `featured` y la personalización como `acceptsCustomerImage` en el modelo público; esta unidad solo transporta metadata, sin cambiar todavía orden, CTA, checkout ni visor.

`sample_color` se mantiene para portada y selección inicial, separado de `allowed_colors`. `NULL` significa registro histórico pendiente de revisión; una lista explícita representa la configuración confirmada y debe contener al menos un hex `#rrggbb`. Administración ofrece únicamente colores presentes en variantes activas, normaliza a minúsculas y elimina duplicados. Al editar un registro histórico parte desde el color de muestra solo cuando ese hex sigue disponible; en otro caso exige selección manual y explica el conflicto. Una lista vacía nunca se persiste ni significa autorización universal.

La migración conserva todos los registros anteriores y sus políticas RLS actuales; no añade costos, archivos privados ni tablas paralelas. La disponibilidad intersecta una lista explícita de `allowedColors` con producto, modelo, talla y variantes activas. Para los registros históricos con `NULL`, usa las variantes publicadas del producto vinculado; `sample_color` conserva su función editorial y solo se preselecciona si existe una variante compatible. Tote mantiene tela natural. La migración se aplicó a producción el 14-10-2026.

### C2 · Diseño de origen frente a archivo del cliente (I02)

Separar semánticamente: identidad/colección/configuración del diseño elegido; arte fijo de catálogo; archivo privado que el cliente entrega. `catalogDesign` hoy gobierna bloqueo y exención de carga: no asignarlo sin adaptar consumidores. El contexto debe sobrevivir a `resetIdea`, elecciones `ready`/`custom`, volver, borrador y carro. Reutilizar `catalog_design_id` del artículo cuando corresponda y las estructuras de solicitud existentes; cualquier cambio mínimo de payload se valida en servidor.

La ruta `ready` sigue trabajando con un archivo listo; la ruta `custom` conserva referencias y contexto para cotización. Elegir un diseño como “Tu Mascota Kaiju” abre primero el modal existente, sin prometer que subir una foto ya genera una ilustración ni cambiar los cobros actuales. No asumir que ese diseño existe en producción: usar fixture de prueba con esa característica.

Si un artículo combina diseño marcado y original propio, `paymentArtworkFor()` y servidor no deben omitirlo por tener slug. El servidor debe verificar que el diseño permite imagen, pertenencia del archivo y producto válido, y conservar identidad + original para producción. La rama creativa también debe conservar la identidad de origen al enviar la solicitud. No sustituir el archivo privado con el artwork de la plantilla en el snapshot.

### C3 · Disponibilidad, variante exacta y precios (I03/I04/I06)

Una única resolución lógica: diseño → producto vinculado → modelo activo → talla activa → intersección de colores permitidos y variantes reales. Reutilizar `product_models`/`product_variants`. La UI usa identificadores/hex normalizados y el servidor selecciona una variante única por modelo+talla+color (o ID verificado contra esos atributos). Un empate no se resuelve por orden de respuesta. Mantener `kid`/`kids` y rechazar valores inválidos, incluidos borradores antiguos.

`loadProductPrices()` debe conservar los datos necesarios para mínimo y precio exacto, no solo un mínimo por modelo. El importe del resumen usa la variante elegida; el “Desde” es el mínimo de variantes activas y elegibles de la familia, también filtrado por diseño si procede, mediante `minimumEligibleVariantPrice`. El servidor sigue recalculando. No exponer costos de proveedores para calcular estos precios públicos. Datos cargando/sin conexión/sin variantes tienen estado explícito; no anunciar defaults como precio autorizado.

Para sincronización de precio basta consulta vigente al cargar/reabrir el selector y revalidación en checkout; no se añade Realtime de precios sin necesidad. Mantener una selección válida cuando llega una actualización; si ya no es válida, explicar y pedir elección o aplicar un reemplazo visible, nunca enviar combinación inválida.

**Contrato de I03 publicado el 14-10-2026:** `normalizeVariantRows`, `allowedVariantRows` y `resolveExactVariant` en `supabase/functions/_shared/variant-selection.js` son la regla compartida por web y ambas funciones de pedido. La variante activa se identifica por modelo activo, talla y hexadecimal normalizado; cero coincidencias o duplicados bloquean la selección. `catalog_designs.allowed_colors` limita la intersección cuando es una lista explícita. Un `NULL` histórico deja decidir a las variantes publicadas; `sample_color` es una preferencia editorial y solo se preselecciona si coincide. Administración exige que, al guardar una configuración explícita, el color de muestra pertenezca a sus colores permitidos. Tote exige natural `#e8e0cf`. El borrador y carro guardan `color` y `variantId`; el servidor vuelve a resolver los atributos, comprueba el ID si llegó y calcula SKU y precio desde la fila vigente. La tienda y las funciones `create-payment-preference` y `create-demo-order` usan esta regla.

### C4 · Bodys (I04/I07)

`body` es el código del modelo comercial y `bodys` es el slug de categoría de insumos y de la nueva familia pública preparada. Lectura acotada del proyecto conectado el 14-10-2026: modelo `body` activo; insumos Bodys en 0–3, 3–6, 6–12 y 12–24 meses; ningún `catalog_product_types` para Bodys, ninguna variante `body` y ningún precio confirmado en esos cuatro insumos. `20261014110124_body_catalog_product.sql` agrega la familia pública **inactiva** y conserva cualquier registro preexistente. No se aplicó al proyecto remoto.

Reutilizar insumos y precios confirmados; verificar tallas en meses. No copiar sin validación las opciones de venta manual de `admin.js` ni inventar tallas de bebé a partir de `kid`. Corregir la correspondencia de meses en `compatibleVariants()` y comprobar que publicar una talla no pisa las restantes. Si faltan variantes, generar solo las respaldadas por los insumos verificados y su precio autorizado. Faltantes comerciales se reportan, no se rellenan con valores locales.

I04 dejó `compatibleSupplierVariants()` filtrando por modelo activo y rango mensual exacto; el test separa dos tallas y rechaza variantes inactivas. `modelProductSlug('body')` exige arte propio bajo `product_artworks.bodys`; ambas funciones de pedido reconocen modelo/talla y preparan el snapshot «Body bebé». `bodyCommerceReady=false` en el helper compartido bloquea estudio y servidor hasta completar precio, variantes, rutas/SEO con precio real y visor de I07. I04 queda **parcial por datos externos y geometría pendiente**; no se publicaron Bodys ni se inventaron precios.

Extender registro de frontend, navegación comprable, helper `modelProductSlug`, consultas, rutas existentes, SEO y listas permitidas del servidor. Asociar archivo de body explícitamente mediante `product_artworks`; no tratarlo automáticamente como polera. El modelo 3D debe representar cierre inferior y aberturas propias: deformar una camiseta o usar `kids` no satisface el requisito. Preferir mantener la API de visor; permitir geometría nueva mínima si la topología de GLB no sirve, identificándola como nueva al implementarla.

### C5 · Orden comercial (I02)

Colecciones: destacado primero; luego `sort_order`, nombre y desempate estable por identificador. Diseños: destacado primero; luego fecha descendente y desempate estable por identificador. En vista global de diseños, aplicar prioridad global de diseño para que una colección no destacada no esconda un diseño destacado. Dentro de cada colección se conserva el mismo criterio. Aplicar tras filtros de actividad/categoría/producto, sin resucitar registros ocultos. La portada toma el primer diseño resultante. Alinear runtime y generación SEO, reutilizando normalización/comparador; no reescribir `sort_order` al marcar destacado.

### C6 · Secuencia y scroll (I10)

Mantener los tres pasos comerciales actuales: Detalles, Resumen, Datos y pago. Dentro de Detalles, ordenar **Producto → Modelo → Talla → Color → Diseño y ubicación**. No añadir pantallas para opciones únicas: mostrar contexto seleccionado y permitir avanzar naturalmente. No habilitar controles dependientes sin una selección válida. Preservar valores compatibles y limpiar únicamente los invalidados por el cambio anterior. Un diseño que llega desde catálogo sigue visible como contexto sin pedir elegirlo nuevamente.

**Implementación local I10:** el DOM de Detalles reordena los bloques a Producto → Modelo → Talla/Edad → Color/Tela → Diseño y ubicación después de cada render, conservando los componentes existentes. El selector de familia filtra modelos y variantes compatibles; la reconciliación existente limpia talla/color/arte solo cuando dejan de ser válidos. Tote mantiene `includedSides()=['front']`; `face()` del visor no cambia ese payload. El scroll del contenedor `.studio-controls` y la clave del control activo se conservan en rerenders del mismo paso con foco `preventScroll`; el snapshot de despacho sigue separado y conserva su scroll intencional. La aceptación en navegador móvil/desktop queda pendiente del usuario.

Comprobar qué elemento scrollea realmente en cada breakpoint: `#studio`, `.studio-controls` o contenedor correspondiente. Para cambios dentro del mismo paso, conservar nodo/foco y posición o restaurarlos sobre el scroller correcto. Distinguir navegación de pasos, apertura/cierre y errores que requieren enfocar. No añadir `scrollTo(0,0)` ni impedir indiscriminadamente todo foco/scroll. La medición DOM puede ejecutarse sin capturas si existe herramienta apropiada; si no, entregar instrucciones reproducibles al usuario y dejar T13 pendiente de confirmación.

### C7 · 3D, referencias y movimiento (I07–I09)

Reutilizar API `update`, `resize`, `face`, `reset`, `turn`, `dispose`. Mantener carga asíncrona con versionado, cancelación, material mate, proporciones de archivo y fallback. No tocar hero o mockups editoriales al introducir el giro del estudio. Propuesta inicial medible: oscilación de hasta 12° y hasta 900 ms, una vez por apertura efectiva con modelo listo; cancelar al primer gesto, teclado de interacción, cierre, pestaña oculta o cambio a movimiento reducido. Son parámetros propuestos para aprobación visual del usuario, no medidas de una referencia real.

**Implementación local I07:** `createGarmentCut(base,'woman')` conserva topología y UV del GLB, con cintura moderada, hombros y mangas diferenciados y cuello protegido. `src/body-geometry.js` crea una malla propia mediante contorno extruido con aberturas de piernas, solapa inferior, costura y tres broches; `garmentPrintArea('body')` restringe el estampado al torso, delante y detrás. El visor mantiene la API y reutiliza material mate, pero descarta mapas horneados de la polera adulta para el Body. El modelo es una aproximación para mockup, sin medidas físicas ni equivalencia de talla.

**Referencias I07, consultadas el 14-10-2026:** la lectura del proveedor Droska solo confirma insumos en 0–3, 3–6, 6–12 y 12–24 meses; no entrega medidas de prenda ni ficha de corte. La [ficha técnica Bella+Canvas 6400](https://www.bellacanvas.com/spec/6400.pdf) indica para polera femenina relaxed un ancho de cuerpo 18½″ en S y 20″ en M, y largo desde hombro 25¼″ y 26″ respectivamente. Se usó solo como referencia de categoría; el proveedor Droska y el GLB no son ese producto. La [ficha Gerber de body manga corta](https://www.gerberchildrenswear.com/products/embroidered-baby-neutral-natural-premium-short-sleeve-onesies-r-bodysuit) describe cuello cruzado expansible y broches inferiores altos; sus rangos de edad no coinciden exactamente con todos los insumos Droska. No se copiaron imágenes, mallas ni patrones de esas fuentes; se documentaron atributos funcionales. La aprobación de proporciones, cuello, mangas, perfil, aberturas, cierre y estampado queda pendiente de revisión visual del usuario.

La investigación de referencias para T4/T6 sigue incluida: priorizar fichas/dimensiones del proveedor real y fuentes del fabricante; guardar enlaces, medidas relevantes y límites de licencia. **Sin análisis visual automatizado ni capturas.** Solicitar al usuario valoración de proporciones, cuello, mangas y cierre inferior. Si faltan medidas fiables, etiquetar aproximación visual y no convertirla en guía de tallas comercial.

En tote, diseñar profundidad/pliegues fuera del centro imprimible, usar una misma superficie para tela/arte y coherencia M/L. Ajustar cámara inicial, responsive, `face()` y `reset()` con objetivo en zona imprimible; permitir zoom/órbita para explorar asas y espalda aunque la única ubicación de impresión sea Frente.

**Implementación local I08:** `toteSurface()` aumenta la profundidad de la base central de aprox. `.029` a `.103` unidades y del borde inferior de `.006` a `.022` por lado, con pliegues concentrados abajo y hacia los costados. El cuerpo sigue en **9.490 vértices y 18.848 triángulos**; no se añadieron segmentos. `totePrintSurface()` usa el mismo perfil para M/L y ambas caras con separación `.0012`. `toteCameraDistance()` centra `TOTE_PRINT_CENTER_Y=-.11` y ajusta distancia por aspect ratio y talla; `face()` y `reset()` comparten ese objetivo. El usuario debe confirmar perfil, costuras, asas, estampado y encuadre móvil visualmente.

**Implementación local I09:** `createIntroTurn()` limita el giro a 12° durante 900 ms y vuelve al frente. El token de apertura de `#studio` impide animaciones tardías o repetidas por rerender; el primer gesto/pulsación de interacción, cierre, pestaña oculta y `prefers-reduced-motion` lo cancelan. No se activa en hero, catálogo ni fuera del visor.

### Definition of Done común

Cada unidad cumple su prompt, pruebas pertinentes y `npm run build`/`npm test`; auditoría de colores si aplica. Cambios limitados al alcance; sin dependencias nuevas salvo necesidad demostrada. Actualizar `docs/design-system.md` si cambia una regla (color editable, secuencia, tote, movimiento) y catálogo DS solo si cambia una primitive. Registrar contrato final, pruebas realizadas/no realizadas y siguiente unidad. La aceptación visual permanece **pendiente del usuario** hasta recibirla; no convertir un build verde en aprobación visual.

## 5. Recomendación de modelos y ahorro

Los IDs `gpt-6-luna` y `gpt-6.1-sol`, y niveles Low/Medium/High, están anunciados como disponibles en las herramientas de esta sesión. Esto verifica los nombres locales en esta fecha, no tarifas, cupos restantes ni disponibilidad perpetua. La [guía oficial de selección de modelos](https://developers.openai.com/api/docs/guides/model-selection) consultada respalda usar Luna para eficiencia y Sol para trabajo más complejo. La asignación por intervención es juicio técnico a partir de los archivos inspeccionados.

- **Económico / Low:** I06 con `gpt-6-luna`; es markup y consumo de un mínimo ya resuelto.
- **Intermedio / Medium:** I02, I05, I09, I10, I11 con `gpt-6-luna`; contratos acotados y pruebas de comportamiento.
- **Avanzado / High:** I01, I03, I04, I07, I08 con `gpt-6.1-sol`; esquema, integridad del pedido o geometría. Se reserva High para estos cruces, sin usar Max por defecto.

Entregar el prompt de una unidad con acceso al repositorio. No pegar nuevamente el prompt maestro ni leer todos los archivos. Leer el contrato §4 que indique el prompt, usar `rg` por símbolos y revisar solo diff pertinente. Escalar Luna a Sol/High únicamente ante una inconsistencia transversal o pruebas que no se puedan resolver de forma localizada; registrar la causa. No abrir subagentes ni auditorías visuales. El costo exacto no se ha calculado ni se promete un porcentaje de ahorro.

## 6. Riesgos, regresiones y decisiones pendientes

### Estado de producción comprobado el 14-10-2026

- Vercel `poleras`: despliegue de producción `dpl_9GhtsrBwdyDAo6GwXd5153R8EsuV` en estado Ready, con 44 rutas SEO generadas desde Supabase. Corrige también el cambio de familia en el estudio: la tarjeta invoca la transición de producto directamente, sin depender de un botón de modelo aún no renderizado.
- Supabase `dgndcklmmnnxyqfmnckh`: migración `20261014025405_catalog_design_configuration` aplicada y registrada. La lectura pública devuelve 17 variantes activas; los 23 diseños publicados tienen al menos un producto elegible con la regla compartida. `create-payment-preference` v18 y `create-demo-order` v6 están activas con esa regla.
- `create-design-request` conserva la versión remota anterior. La revisión automática rechazó su despliegue porque puede crear pedidos y enviar correos; requiere autorización específica si se desea publicar la parte de solicitud creativa vinculada a un diseño.
- Vercel no tiene `VERCEL_DEPLOY_HOOK_URL` en Production. Los cambios de catálogo hechos desde Administración no podrán disparar por ahora la regeneración automática de páginas SEO y sitemap.
- Body mantiene cero variantes vendibles y no tiene precios confirmados por rango mensual. `20261014110124_body_catalog_product.sql` sigue local e inactiva por diseño; no habilitar venta hasta cerrar I04 y la aceptación visual del usuario.
- El historial remoto de migraciones de tallas infantiles y Mujer usa versiones distintas de los archivos locales; las filas vigentes ya muestran edades infantiles, Mujer y solo S/M/L activos en adulto. Conciliar versiones antes de ejecutar `db push` indiscriminadamente.
- La lectura pública, los tests y el build comprueban disponibilidad; falta un pedido de prueba de extremo a extremo y la revisión visual del usuario.

| Riesgo | Mitigación / evidencia requerida | Responsable |
| --- | --- | --- |
| Trabajo local previo amplio | Registrar diff antes/después, no resetear ni reformatear archivos completos; verificar símbolos, no líneas antiguas | Todas |
| Foto privada tratada como catálogo fijo | Fixture con diseño marcado + foto distinta; verificar original privado, identidad y snapshot tanto en compra como solicitud creativa | I01/I02 |
| Colores históricos sin SKU o precio correcto | Inventario acotado de variantes; transición explícita y rechazo de selección inválida en servidor | I03 |
| Precios de meses cruzados | Dos tallas body con precios diferentes; publicar una y comprobar que la otra queda intacta | I04 |
| Datos de Bodys no disponibles | Bloquear solo publicación comercial dependiente; registrar qué dato falta; no sembrar valores ficticios | I04 |
| Archivo equivocado al cambiar familia | Prueba rectangular/cuadrado, cambios rápidos y error de carga; no dejar estado parcialmente cambiado | I05 |
| Metadata/orden distintos en SEO | Fixture único comparado entre loader, render y generador; rebuild autenticado existente | I01/I02/I04 |
| Doble render/foco/scroll | Medición antes/después por control y breakpoint; conservar navegación intencional del checkout | I10 |
| Geometría y decal incompatibles | Bounds/normales/área imprimible por prenda; usuario aprueba vistas frontales, laterales y traseras | I07/I08 |
| Giro mueve hero o vuelve a dispararse | Limitación a sesión de estudio, cancelación y cleanup verificados | I09 |
| DS en conflicto con requisitos nuevos | Actualización normativa dentro de la unidad que cambia la regla; usuario ya pidió el cambio | I03/I07/I08/I10 |
| Build remoto no verificable | Registrar respaldo; repetir contra entorno de pruebas disponible antes de declarar SEO real listo | I11 |
| Pruebas Node no cubren DOM/Edge Functions | Añadir pruebas de lógica compartida donde corresponda; contratos de servidor en entorno aislado, escenarios DOM sin captura o manuales | I02/I03/I04/I10/I11 |

Datos pendientes concretos: variantes, colores y precios activos por `body`; asociación pública de Bodys; versiones remotas aplicadas; presencia real de “Tu Mascota Kaiju”; referencias autorizadas de prendas; reproducción de scroll por breakpoint. No bloquean esta documentación. Deben resolverse en la unidad propietaria antes de declarar su aceptación.

**Fuera de alcance:** migración de framework, refactor general de `main.js`/`admin.js`, optimización del chunk existente, rediseño del checkout, nuevas analíticas, generación automática de arte y activación de otras familias futuras. La discrepancia de precios fijos en algunas páginas SEO merece revisión posterior; al integrar Bodys no copiar ese defecto ni ampliar T10 a una reescritura general del SEO.

## 7. Checklist de validación final (T14)

Registrar por fila: resultado (aprobado/fallido/bloqueado/pendiente del usuario), datos de prueba, evidencia y unidad responsable. No usar datos de clientes reales para fixtures. Las filas V01–V18 corresponden uno a uno a las 18 verificaciones originales.

| ID | Verificación y evidencia mínima | Responsable |
| --- | --- | --- |
| V01 | Diseño marcado desde home, diálogo, enlace compartido y SEO abre “¿Qué tienes hoy?” con contexto | I02 |
| V02 | Foto válida se carga por flujo existente; tipo inválido, >50 MB y error tienen feedback; archivo correcto llega a compra o solicitud creativa | I02 |
| V03 | Diseño tradicional conserva arte fijo, caras permitidas y compra; propio independiente sigue operativo | I02/I11 |
| V04 | Pill de personalización presente solo en diseños marcados, con texto legible y nombre accesible coherente | I02 + usuario |
| V05 | Colores admin = intersección elegible del frontend; selección persiste y servidor rechaza manipulación | I03 |
| V06 | Destacados primero en colecciones y diseños; resto mantiene orden, filtros/ocultos y portada coherente en SEO | I02 |
| V07 | Bodys aparece, usa modelo/insumos/variantes/precios reales; meses y precio por talla correctos en pedido | I04/I06 |
| V08 | Mujer diferenciada y body reconocible; cuello/mangas/cierre; modelos previos sin regresión | I07 + usuario |
| V09 | Polera usa arte rectangular asignado; elección/cambio/recarga/carro/pedido coinciden | I05 |
| V10 | Tote usa cuadrado asignado; sin estirar ni sustituir con rectangular cuando falta recurso | I05 |
| V11 | Tote con base y laterales de volumen textil, M/L y estampado continuo | I08 + usuario |
| V12 | Encuadre inicial y reset priorizan impresión; el usuario puede explorar asas y espalda | I08 + usuario |
| V13 | Producto→Modelo→Talla→Color→Diseño y ubicación en DOM, teclado y pantalla; solo Frente en tote | I10 + usuario |
| V14 | “Desde $XX.XXX” en Hombre, Mujer, Niños, Tote bag y Bodys; mínimo elegible cambia con precio admin, sin número ficticio en error | I06 |
| V15 | Giro breve una vez por apertura; se cancela al interactuar; movimiento reducido y móvil respetados | I09 + usuario |
| V16 | Sin salto involuntario en Frente/Espalda/color/talla/modelo/producto/carga; foco y scroll correctos al volver | I10 + usuario |
| V17 | Usuario revisa móvil (360/390 px), tablet y escritorio, orientación, táctil, teclado y texto sin desbordes | Usuario |
| V18 | `npm test`, build y checks pertinentes; regresiones de pedidos, edición de carro, cotización, archivos privados, precios, despacho y pago en sandbox | I11 |

Complementos de cierre: sesión anónima/autenticada donde corresponda; borrador y carro previos; cambio rápido de producto y cierre durante carga; ausencia de WebGL; pérdida de red; categoría o variante desactivada; ausencia de artwork; reduced motion; repetición de aperturas sin listeners/loops crecientes. Pagos y correo se prueban con mocks o entorno de prueba, sin cargos ni envíos reales no solicitados.

Outcome First: el cliente reconoce cuándo debe aportar foto, nunca elige una combinación no fabricable, ve un precio inicial válido y puede terminar su configuración sin perder archivo ni posición. La evidencia será éxito de estos escenarios, **sin inventar métricas de conversión ni añadir telemetría**.

## 8. Primera intervención

Ejecutar **I01 — Configuración compartida en persistencia y administrador**, con **`gpt-6.1-sol` / High**, entregando [01-configuracion-admin.md](docs/droska-tasks/01-configuracion-admin.md). Es la única base común que deben consumir foto, destacados y multicolor. No ejecutar todo el roadmap en una sola conversación de implementación.
