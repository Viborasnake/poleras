# I04 · Bodys en catálogo, insumos y compra

Modelo: **gpt-6.1-sol · High**. Fase 2. T4 comercial. Dependencia: I03. Geometría se entrega en I07.

## 1. Objetivo específico

Conectar Bodys con sus datos comerciales reales y el flujo existente sin duplicar modelos, inventar tallas o vender una prenda incompleta.

## 2. Contexto técnico mínimo

Lee [reglas](README.md), C3/C4 y T4 del [plan](../../PLAN_DROSKA.md). La migración `20260928090000_supplier_pricing.sql` crea `product_models.code='body'`. `20260928153000_supplier_category_tree.sql` define categoría de insumos `bodys`; eso no prueba existencia de familia pública. El frontend y los servidores aún no lo admiten. `compatibleVariants()` reconoce tallas adultas y edades en años, pero no discrimina rangos de meses.

## 3. Archivos involucrados

`src/admin.js`: `compatibleVariants`, `supplierProductVariants`, `pricesView`, publicación de precios. `src/main.js`: registros de productos/familias, etiquetas, disponibilidad, selección inicial/URL, resumen y carro. `src/product-navigation.js`; `supabase/functions/_shared/catalog-product-artworks.js` reexportado por `src/catalog-product-artworks.js`; `src/catalog-page.js`, `src/catalog-page-render.js`, `scripts/generate-catalog-pages.mjs`; funciones `create-payment-preference` y `create-demo-order`. Tests de catálogo, navegación, rutas, render e insumos. DS. Migración aditiva solo si datos/esquema la requieren.

## 4. Instrucciones de implementación

1. Verificar mediante lectura acotada de entorno disponible el modelo `body`, insumos Bodys, rangos de meses, colores, precios confirmados y variantes activas. Registrar datos faltantes; no asumir que las tallas del formulario de venta manual son catálogo vigente.
2. Reutilizar familia pública si existe; si no, preparar asociación mínima en `catalog_product_types` y registrar su slug en C4. No renombrar colecciones existentes ni confundir temática “Para el bebé” con prenda.
3. Corregir asociación exacta de meses en `compatibleVariants` y publicación de precio. Comprobar que un insumo no actualiza todos los bodies por carecer de filtro de talla. Vincular/crear solo variantes respaldadas por datos confirmados.
4. Añadir familia/modelo al selector y al catálogo público, al helper de producto y navegación, a rutas/SEO actuales y a las entradas directas. Body debe tener vínculo explícito de artwork. No tratarlo como `poleras` por fallback.
5. Extender validaciones de modelo/talla/color y snapshots en ambas funciones; usar variantes activas y contrato I03. Etiquetar como Body/Bodys en resumen, carro y pedido, sin imponer “Polera”.
6. Mantener la entrega en entorno de prueba sin publicación comercial de Bodys hasta I07 y aceptación. Registrar en C4 slugs, códigos, tallas, relación de insumos y punto de integración del visor.

## 5. Restricciones

No precios o edades inventados, no nuevo motor de costos, no recrear `body`. No deformar `kids` como sustituto del modelo requerido. No modificar pedidos históricos ni desplegar. Datos comerciales desconocidos bloquean únicamente su habilitación comercial, no justifican fabricarlos. Sin capturas.

## 6. Pruebas

Dos tallas en meses con precios diferentes: editar una conserva la otra. Variantes faltantes/inactivas, color no disponible, catálogo sin artwork y rutas directas. Verificar que servidor acepta solo talla/variante válida y snapshot correcto. Polera/tote siguen funcionando. `npm test`, `npm run build`; anotar si SEO usa respaldo local y falta validación remota.

## 7. Criterios de aceptación / Definition of Done

Bodys aparece en entorno de pruebas y usa datos verificados de admin, precio exacto y nombre correcto; no hay cruce de meses. Backend y frontend concuerdan. T4 queda **parcial, pendiente de I07**, y precios de mini cards en I06. Siguiente **I05**.

## Resultado parcial de I04 · 14-10-2026

La lectura acotada del proyecto conectado confirmó `body` activo, insumos `bodys` de 0–3, 3–6, 6–12 y 12–24 meses, pero ninguna variante, precio confirmado ni tipo de catálogo público. Se agregó una migración local para `bodys` inactivo; no se aplicó remotamente. `compatibleSupplierVariants()` evita que un precio de una edad alcance otra. Web y ambas funciones conocen el código, rango mensual y vínculo explícito del arte, pero `bodyCommerceReady=false` impide venderlo sin precio y visor propios. Las rutas/SEO comerciales y la habilitación quedan pendientes de datos reales e I07. No se hicieron capturas, despliegues ni cambios en pedidos históricos.
