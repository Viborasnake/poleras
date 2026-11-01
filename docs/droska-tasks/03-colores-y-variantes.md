# I03 · Colores permitidos y variante exacta

Modelo: **gpt-6.1-sol · High**. Fase 1. **T2 + T11 juntas**. Dependencias: I01; I02 para contexto de foto.

## 1. Objetivo específico

Ofrecer solo combinaciones fabricables y mantener color, SKU y precio consistentes desde administrador hasta pedido y visor.

## 2. Contexto técnico mínimo

Lee [reglas](README.md) y C1/C2/C3 del [plan](../../PLAN_DROSKA.md). `loadProductPrices()` carga talla/precio, no color; `colorDock` y `renderStep` repiten cuatro swatches. El catálogo bloquea color. Los servidores construyen mapas por modelo:talla, perdiendo distinción por color. `kid`/`kids` es un alias existente.

## 3. Archivos involucrados

`src/main.js`: `loadProductPrices`, `products`, `productPrice`, `colorDock`, `renderStep`, cambios de familia/modelo/talla/color, `previewState`, `persistDraft`, carro/payloads. `src/admin.js` solo si el consumidor revela un defecto de la configuración. `src/catalog.js`/tests y helper compartido existente bajo `supabase/functions/_shared/` si permite alojar la regla sin mezclar responsabilidades; un helper nuevo solo si la extracción pequeña se justifica y documenta. `supabase/functions/create-payment-preference/index.ts`, `create-demo-order/index.ts`; `docs/design-system.md`.

## 4. Instrucciones de implementación

1. Consultar variantes y modelos activos con ID, talla, color/nombre y precio. Conservar datos por variante para disponibilidad y precio exacto; eliminar ambigüedad por color.
2. Aplicar C3: producto vinculado + modelo + talla + colores permitidos. Reutilizar identidad/colores del admin, incluido contexto personalizable de C2. Tote conserva natural mientras sea su única variante autorizada.
3. Mostrar selección de uno o varios colores según datos; etiqueta visible y estado accesible. Un único valor no implica inventar un selector vacío. `sample_color` solo decide preferencia inicial válida.
4. Mantener elección válida al volver/cambiar talla/modelo; reconciliar inválida con explicación. Guardar/restaurar color y variante en borrador/carro; actualizar 3D por `viewer.update(previewState())`, sin recrearlo por swatch.
5. Resolver en ambas funciones del servidor la variante exacta y validar restricciones del diseño, color y disponibilidad. No aceptar precio del navegador. Rechazar duplicados ambiguos, hex arbitrario y opciones desactivadas con error recuperable.
6. Preparar mínimos por familia para I06 y consumo extensible por `body` para I04. Registrar en C3 nombres/símbolos y compatibilidad. No inventar variantes para conservar una oferta histórica sin datos.

## 5. Restricciones

No duplicar paleta, configuración o tabla de variantes. No usar primer SKU coincidente; no convertir color desconocido silenciosamente a blanco. No cambiar reglas de pagos ni su confirmación. No activar nueva restricción en producción sin reconciliar datos. Sin análisis visual.

## 6. Pruebas

Mismo modelo/talla con dos colores y precios distintos; restricción de diseño; modelo/variante inactivos; cero intersección; color retirado durante el flujo; restauración de carro antiguo; hex con mayúsculas; alias infantil; tote natural. Servidor debe rechazar payload manipulado y calcular SKU/precio correcto. `npm test`, build y auditoría de colores pertinente; no presentar Node como prueba de Deno desplegado.

## 7. Criterios de aceptación / Definition of Done

T2/T11 y V05 completos técnicamente: fuente única, selección persistente, visor actualizado y variante inequívoca en pedido. Tests demuestran precios distintos por color sin colisión. Checklist visual del selector para el usuario. Siguiente **I04**.

## Resultado de I03

Regla compartida en `supabase/functions/_shared/variant-selection.js`; web consulta variantes y modelos activos con color, nombre, talla y precio. El estudio muestra solo la intersección elegible y omite combinaciones ambiguas, guarda color/ID y actualiza el visor. Administración obtiene colores de variantes activas y exige que el color de muestra pertenezca a los permitidos. Carro y ambas funciones resuelven modelo+talla+color, rechazan ambigüedad y recalculan el precio en servidor. `npm test` 88/88, `npm run build`, `npm run audit:a11y-colors` y `git diff --check` pasaron. Build SEO con respaldo local por falta de acceso remoto; Edge Functions no se ejecutaron en Deno (no instalado). La revisión visual del selector queda para el usuario; no se desplegó a producción.
