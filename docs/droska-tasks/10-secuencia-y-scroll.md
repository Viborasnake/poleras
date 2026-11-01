# I10 · Secuencia de personalización y estabilidad de scroll

Modelo: **gpt-6-luna · Medium**. Fase 4. **T9 + T13 juntas**. Dependencias: I02–I06; ejecutar tras I09 para integrar visores estables.

## 1. Objetivo específico

Que el usuario configure Producto→Modelo→Talla→Color→Diseño y ubicación sin perder elecciones, foco o posición dentro del modal.

## 2. Contexto técnico mínimo

Lee [reglas](README.md), C2/C3/C6 y T9/T13 del [plan](../../PLAN_DROSKA.md). Hay tres pasos comerciales; el orden pedido corresponde a bloques de Detalles. `renderStep` reemplaza `#step-content` y registra handlers otra vez. Ese reemplazo es candidato al salto, no causa comprobada en navegador. Existe scroll intencional de despacho con `checkoutScrollSnapshot` y `scrollIntoView`; no eliminarlo por intuición.

## 3. Archivos involucrados

`src/main.js`: `renderStep`, `openDialog`/observer de foco, handlers de producto/talla/color/caras/carga, `setPrintSides`, `includedSides`, `faceSelectedSide` y back/next; `src/style.css`: orden/grid/overflow del estudio y responsive. `src/accessibility.css` solo si se identifica causa allí. `docs/design-system.md`.

## 4. Instrucciones de implementación

1. Ordenar DOM y lectura de Detalles según C6. Mantener los tres pasos y opciones únicas sin pantallas redundantes. Mostrar/activar dependientes solo con selección anterior válida; contexto de catálogo no se vuelve a pedir.
2. Aplicar reconciliación de I03 e I05 para conservar talla/color/archivo compatibles al cambiar producto. La selección de una familia no puede dejar datos de otra.
3. Asegurar Frente como única ubicación de tote en UI, estado restaurado, resumen y payload. Explorar espalda en 3D no la hace imprimible. Poleras conservan caras existentes según tipo de diseño.
4. Identificar el scroller efectivo en escritorio/móvil y el disparador real con mediciones DOM sin capturas si hay herramientas: scrollTop, elemento activo, render y tamaño antes/después. Si no se puede reproducir así, dar pasos al usuario y distinguir hipótesis de diagnóstico confirmado.
5. Preferir actualizaciones localizadas dentro del mismo paso. Si el reemplazo es imprescindible, preservar identidad/foco y posición del scroller correcto con `preventScroll` donde corresponda. No restaurar indiscriminadamente durante cambio de paso o foco por error.
6. Revisar todos los controles: Frente/Espalda/Ambos cuando aplique, modelo, talla, color, producto, guía de tallas, añadir/quitar archivo, escala y navegación. Mantener scroll de despacho intencional separado. Actualizar DS, incluida la contradicción previa sobre caras de tote.

## 5. Restricciones

Sin refactor del estado completo, nuevas pantallas, timeouts arbitrarios para esconder el salto o `window.scrollTo(0,0)`. No fijar foco siempre al diálogo ni deshabilitar navegación por teclado. No hacer revisión visual, capturas o videos; el usuario valida apariencia.

## 6. Pruebas

Transiciones desde catálogo, diseño propio y foto personalizada; volver/avanzar, recargar borrador/editar carro; retirar color/talla mientras se configura. Medir scroll antes/después en controles que no cambian altura (tolerancia propuesta ≤2 px); en cambios estructurales preservar control/contexto visible sin salto al inicio. Desktop y móvil por DOM si disponible, o checklist manual pendiente. `npm test`, build, auditoría si cambia color.

## 7. Criterios de aceptación / Definition of Done

V13/V16: orden DOM/teclado correcto, sin selección inválida ni pérdida de archivos; scroll/foco estables con evidencia de reproducción/corrección. No marcar T13 resuelta solo por lectura de código o tests unitarios; si falta navegador/evidencia del usuario, dejar pendiente esa aceptación. Siguiente **I11**.

## Resultado I10 · 14 de octubre de 2026

Implementado el orden Producto → Modelo → Talla/Edad → Color/Tela → Diseño y ubicación dentro de Detalles. Los rerenders del mismo paso conservan `scrollTop` de `.studio-controls` y devuelven foco al control seleccionado con `preventScroll`; cambios de producto siguen usando la reconciliación de variantes y arte existente. Tote mantiene solo Frente en estado, resumen y payload, aunque su visor permite explorar la espalda. Pruebas: `npm test` (102/102), build y `git diff --check`. La comprobación real de scroll/foco en tus breakpoints queda pendiente de tu revisión, sin capturas automatizadas. Siguiente **I11**.
