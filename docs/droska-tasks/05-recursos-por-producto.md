# I05 · Archivo correcto en cada cambio de producto

Modelo: **gpt-6-luna · Medium**. Fase 2. T5 y arte de T4. Dependencia: I04 para incluir Body.

## 1. Objetivo específico

Que selección inicial y cambios de familia/modelo muestren y guarden siempre el archivo asignado al producto, sin distorsión ni estado parcial.

## 2. Contexto técnico mínimo

Lee [reglas](README.md) y diagnóstico/C2/C4 del [plan](../../PLAN_DROSKA.md). Ya existen `product_artworks`, `designProductArtworks`, `designForProduct`, `modelProductSlug` y snapshot `catalog_artwork_path`. El handler `[data-product-family]` no recarga arte, a diferencia de `[data-product]`. La conversión a canvas de 2400×2880 usa contención: ese lienzo no demuestra por sí solo deformación del archivo.

## 3. Archivos involucrados

`src/main.js`: `chooseCatalogDesign`, handlers de familia/modelo, `loadCatalogArtwork`, `drawContainedArtwork`, `uploadVersions`, preview y carro. `src/catalog-product-artworks.js`/`supabase/functions/_shared/catalog-product-artworks.js` solo si hay brecha de contrato. `src/artwork-fit.js` y tests, `src/catalog.test.js`; `src/garment.js`/`src/tote-viewer.js` solo si una prueba demuestra fallo de proporciones. Leer snapshot en ambas funciones de pedido; no reescribirlo si ya es correcto.

## 4. Instrucciones de implementación

1. Reutilizar una transición común y acotada para familia/modelo/entrada directa: resolver producto y recurso, cargar, aplicar estado, luego renderizar. Mantener validación de colores/variantes de I03.
2. Si cambia familia de producto, cargar su recurso; si cambia solo corte dentro de poleras, no recargar innecesariamente. Para foto propia de I02 preservar el original del cliente, no reemplazarlo por plantilla.
3. Dar a cargas async un token/versionado por transición. Una respuesta antigua no puede sobreescribir el producto más reciente ni revocar su URL. En fallo, mantener estado previo coherente y permitir reintento.
4. Usar arte rectangular de polera y cuadrado de tote según asignación administrativa, no según filename o recorte artificial. Contener proporciones y alfa; conservar originales, separar mockups editoriales.
5. Probar salto desde Espalda de polera a tote: solo Frente, archivo de tote correcto y sin residuos. Body usa asociación explícita registrada en I04. Sin archivo, impedir combinación con explicación.

## 5. Restricciones

No crear otra tabla/mapa de imágenes ni volver a subir archivos existentes. No inferir recursos de productos no vinculados ni estirar un rectangular para simular cuadrado. No refactor general de render. Sin revisión visual automatizada.

## 6. Pruebas

Fixtures con URLs distintas por producto y proporciones conocidas. Selección inicial, familia, modelo, URL directa, resumen, edición/restauración de carro y snapshot. Cambios rápidos con respuestas invertidas, error y cierre durante carga; propio/tradicional/personalizable. Tests de `artwork-fit` y catálogo, `npm test`, build. Entregar al usuario comparación visual polera/tote/body.

## 7. Criterios de aceptación / Definition of Done

V09/V10 correctos, misma identidad de recurso en visor/resumen/pedido, sin respuestas atrasadas ni deformación matemática. La revisión visual la realiza el usuario. Siguiente **I06**.

## Resultado de I05 · 14-10-2026

La transición de familia reutiliza el handler de cambio de producto y por tanto resuelve el mismo arte asignado, limpia espalda al pasar a tote y conserva el vínculo explícito `bodys` para Body. Los cambios de producto con catálogo usan `productTransitionVersion`; una respuesta antigua restaura controles y no sobreescribe el producto vigente. `designForProduct` sigue siendo la única resolución de `product_artworks`, y el snapshot `catalog_artwork_path` ya se mantiene en ambas funciones de pedido. No se subieron archivos nuevos ni se hizo revisión visual. `npm test` 90/90, build y `git diff --check` pasaron; I06 queda como siguiente intervención.
