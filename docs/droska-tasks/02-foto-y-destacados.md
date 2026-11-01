# I02 · Personalización por foto y prioridad editorial

Modelo: **gpt-6-luna · Medium**. Fase 1. T1 + T3. Dependencia: I01 con C1 final.

## 1. Objetivo específico

Que el cliente reconozca un diseño personalizable, entre al flujo existente con su contexto y que administración controle lo primero que se muestra.

## 2. Contexto técnico mínimo

Lee [reglas](README.md), C1/C2/C5 y fila T1/T3 del [plan](../../PLAN_DROSKA.md). `beginIdea()` resetea contexto; `catalogDesign` bloquea el archivo; `paymentArtworkFor()` y ambas funciones omiten originales cuando hay slug. No basta con cambiar el CTA. `renderCatalog()` agrupa diseños por colección, por lo que ordenar solo el array inicial no garantiza destacados globales.

## 3. Archivos involucrados

`src/main.js`: `catalogDesignCard`, `chooseCatalogDesign`, `beginIdea`, `resetIdea`, `renderStep`, `upload`, `addReferenceFiles`, `persistDraft`, carro y `paymentArtworkFor`/payloads. `src/catalog.js`, `src/catalog-page-render.js`, `src/catalog-page.js`, `scripts/generate-catalog-pages.mjs`; tests de catálogo/render/rutas. `src/style.css` y `src/catalog-page.css` solo pill. `supabase/functions/create-payment-preference/index.ts`, `create-demo-order/index.ts`, `create-design-request/index.ts`; `docs/design-system.md`.

## 4. Instrucciones de implementación

1. Aplicar comparador de C5 para colección y diseño en runtime/SEO, incluyendo vista global, filtros, portada y relacionados. Reutilizar una regla, no múltiples ordenamientos divergentes.
2. Añadir pill textual accesible a las cards marcadas, incluidas las SEO. Resolver todas las entradas de selección con el indicador de I01; el diseño normal mantiene camino actual.
3. Para diseño marcado, abrir `#studio` en `choose` reutilizando “¿Qué tienes hoy?”. Conservar contexto de diseño/colección/productos autorizados sin convertir la foto en arte fijo ni perderlo al resetear.
4. Conectar las dos rutas existentes: `ready` usa `upload`; `custom` usa referencias y solicitud creativa. Conservar origen en borrador, vuelta atrás, carro y solicitud/pedido. No generar ilustraciones ni cambiar la política de cotización.
5. Ajustar envío y validación de original: diseño marcado + foto necesita archivo privado válido, identidad del diseño y producto permitido. No saltar carga por slug ni guardar una plantilla como original. Reutilizar columnas/payload existentes cuando representen el dato; documentar en C2 cualquier extensión mínima imprescindible.
6. Manejar error/cancelación de carga y reentrada; al pasar después a tradicional o diseño propio no filtrar contexto de la mascota anterior.

## 5. Restricciones

No nuevo modal, editor de imágenes, IA generativa ni orden manual alternativo. No cambiar precios o colores aquí. Si persistencia/payload no puede representarse sin otro cambio transversal, delimitarlo y escalar a Sol/High; no esconder metadata solo en una etiqueta UI. Sin capturas.

## 6. Pruebas

Orden estable con varios destacados, empates, categorías ocultas y diseños en varias familias; no modificar `sort_order`. Fixtures de tradicional, personalizable y propio: cargar foto, volver, restaurar carro, elegir otra ruta; comprobar original y origen en servidor mediante entorno aislado/mocks. Archivo corrupto, >50 MB y fallo de carga. `npm test`, `npm run build`, auditoría si corresponde.

## 7. Criterios de aceptación / Definition of Done

V01–V04 y V06 tienen evidencia técnica; metadata visible/orden/pill se entregan al usuario para revisar. Una foto no se pierde ni se sustituye en producción del pedido. El tradicional sigue comprable. C2/C5 actualizados, sin emails ni pagos reales. Siguiente **I03**.

## Resultado de I02

Aplicado sin revisión visual: comparador `compareCatalogPriority` compartido por runtime y SEO, pill textual en cards, entrada de diseños marcados por “¿Qué tienes hoy?”, persistencia de contexto, validación server side de `accepts_customer_image` y conservación de originales privados junto a la identidad de catálogo. Verificación: `npm test` (86), `npm run build` y `npm run audit:a11y-colors`.
