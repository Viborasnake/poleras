# I06 · Precio inicial en mini cards

Modelo: **gpt-6-luna · Low**. Fase 2. T10. Dependencias: I03 e I04 con contratos terminados.

## 1. Objetivo específico

Mostrar “Desde $XX.XXX” en Hombre, Mujer, Niños, Tote bag y Bodys a partir de variantes elegibles reales.

## 2. Contexto técnico mínimo

Lee [reglas](README.md) y C3/T10 del [plan](../../PLAN_DROSKA.md). Las cards de `productFamilies` en `renderStep()` no tenían precio. `products` contenía defaults locales: no sirven como evidencia de precio publicado. I03 debe haber conservado variantes y resuelto mínimo/precio exacto; consume ese contrato, no lo rediseñes.

## 3. Archivos involucrados

`src/main.js`: `loadProductPrices`, `productFamilies`, `productsForFamily`, `money` y markup de mini cards en `renderStep`. `src/style.css` solo si se necesita una regla localizada. Prueba de la función de mínimo creada en I03; localizar su nombre en C3.

## 4. Instrucciones de implementación

1. Calcular/consumir mínimo de variantes activas de todos los modelos de la familia, restringidas por diseño/producto/color cuando corresponda; no solo el primer modelo ni precio de una talla no seleccionable.
2. Renderizar con `money()` y prefijo literal “Desde ” en las cinco cards. Mantener precio exacto del resumen independiente del mínimo.
3. Resolver carga/error/sin variantes con texto honesto, sin `$0`, `Infinity` ni defaults como importe vigente. No ofrecer avance si faltan opciones válidas.
4. Reconsultar precios al cargar/reabrir el selector usando el ciclo existente, con deduplicación de solicitud si corresponde; una publicación de admin se refleja sin tocar frontend. Conservar selección válida cuando llega la respuesta.

## 5. Restricciones

Sin valores CLP hardcodeados, nuevas tablas, Realtime, motor de precios o rediseño. Si I03 no entregó la regla base, reportar dependencia en vez de implementarla improvisadamente con Low. No ampliar a una reescritura del SEO. Sin capturas.

## 6. Pruebas

Mínimo entre básica/oversize; talla/color más barato desactivado; diseño que excluye el más barato; body por meses; actualización tras nueva consulta y error remoto. Usar pruebas de regla de mínimo, sin tests que solo copien el HTML. `npm test`, build; usuario valida lectura y alineación.

## 7. Criterios de aceptación / Definition of Done

V14 satisfecho: cinco familias, formato chileno, origen administrativo verificable y mínimos elegibles. El resumen cobra la variante elegida. Siguiente **I07**.

## Resultado I06 · 14 de octubre de 2026

Implementado sin cambios visuales: el mínimo se calcula desde variantes activas normalizadas y filtradas por familia y diseño; las cards muestran `Desde` solo cuando existe un precio elegible. La carga se deduplica y vuelve a consultar al abrir el selector. SEO deja de usar montos locales como evidencia y comunica `Precio por confirmar` cuando no existe una variante activa. Bodys conserva estado bloqueado porque el catálogo remoto aún no entrega variantes ni precios publicables.

Validación: `npm test`, `npm run build` y `git diff --check`. Sin revisión visual automatizada.
