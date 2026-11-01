# I11 · Validación integral y cierre de alcance

Modelo: **gpt-6-luna · Medium**. Fase 5. T14; cobertura de T1–T13. Dependencias: I01–I10 técnicamente terminadas.

## 1. Objetivo específico

Demostrar que administración, catálogo, personalización, recursos, visores y pedido operan con el mismo contrato, y entregar al usuario la validación visual pendiente sin darla por realizada.

## 2. Contexto técnico mínimo

Lee [reglas](README.md), matriz §2, riesgos §6 y checklist §7 del [plan](../../PLAN_DROSKA.md). Línea base de planificación: 84 pruebas y build aprobados; SEO generó respaldo local por fallo de red. No se verificó producción ni se hizo E2E/visual. Usar traspasos de unidades, no repetir análisis completo del repositorio.

## 3. Archivos involucrados

`PLAN_DROSKA.md`, este índice y notas de unidades; tests bajo `src/*.test.js`, `scripts/audit-color-contrast.mjs`, `scripts/generate-catalog-pages.mjs`, `package.json`. Inspeccionar código de unidad solo al localizar un fallo. Referencias a funciones de pedido y solicitud creativa para contratos; no ampliar a auditoría general de seguridad/pagos.

## 4. Instrucciones de implementación

1. Verificar estado real de cada intervención y sus contratos. Preparar fixtures: tradicional, personalizable por foto, propio, varios colores y restricción, destacados/ocultos, rectangular/cuadrado, variantes Body verificadas, tallas/precios distintos, archivo faltante y ausencia de red/WebGL.
2. Ejecutar checks pertinentes de catálogo/arte/variantes/estado/geometría, `npm test` y `npm run build`; auditoría de colores si hubo cambios de color. Registrar si catálogo remoto se validó o solo respaldo. No elevar un warning preexistente a nueva tarea ajena.
3. Validar contratos en entorno aislado: variante/precio/SKU exactos, color manipulado rechazado, archivo privado del usuario conservado, vínculo de diseño, body por meses, tote frontal; ambos creadores de pedidos y solicitud creativa.
4. Cubrir enlaces directos/compartidos/SEO, cambio rápido de producto, volver/restaurar borrador/carro, edición, cargas interrumpidas y sesión. No efectuar cargos, emails o escrituras productivas para probar.
5. Completar V01–V18 con evidencia y estado. Para apariencia/proporciones/encuadre/giro/scroll móvil solicitar al usuario ejecutar el checklist existente; no tomar capturas ni analizar visualmente el sitio. Se pueden recoger sus resultados en texto.
6. Entregar reporte final de defectos por unidad, severidad e impacto. Arreglos pequeños del alcance pueden verificarse localmente; fallos transversales vuelven a la unidad propietaria con pasos reproducibles, sin rediseñar arquitectura dentro de QA.

## 5. Restricciones

No afirmar “todo listo” mientras haya P0 abierto, verificaciones bloqueadas o aceptación visual pendiente. No borrar pruebas, suavizar aserciones ni completar casillas por inferencia. Sin nueva funcionalidad, métricas inventadas, Playwright instalado por defecto ni revisiones visuales del agente.

## 6. Pruebas

Cada V01–V18 debe tener test/medición/log o confirmación explícita del usuario según su naturaleza. Conservar regresiones básicas/oversize/niños/Mujer/tote/body, catálogo tradicional, referencias creativas, archivos privados, precios, pedido/checkout en sandbox, despacho, teclado y fallback. Marcar claramente lo que no se pudo ejecutar y por qué.

## 7. Criterios de aceptación / Definition of Done

Los 14 requerimientos y 18 controles están trazados; checks técnicos aprobados y riesgos resueltos o pendientes identificados. Solo declarar implementación integral aceptada cuando el usuario haya aprobado también la revisión visual. El reporte distingue técnico listo, pendiente visual y bloqueado por entorno/datos. No hay siguiente implementación automática fuera del alcance.

## Resultado I11 · 14 de octubre de 2026

La validación técnica local queda trazada. `npm test` pasa **102/102**; `npm run build` pasa y genera 16 páginas SEO usando catálogo local de respaldo porque la consulta remota devolvió `fetch failed`; `npm run audit:a11y-colors` pasa todos sus pares; `git diff --check` no reporta errores. No se hicieron cargos, emails, escrituras productivas, capturas ni revisión visual automatizada.

| Controles | Estado | Evidencia / pendiente |
| --- | --- | --- |
| V01–V03 | Pendiente de usuario | Contratos de catálogo, carga y pedido tienen pruebas unitarias; faltan recorridos de home, enlace compartido y SEO en navegador. |
| V04 | Pendiente de usuario | Pill y lectura accesible están implementadas; falta comprobación de legibilidad en breakpoints. |
| V05–V06 | Aprobado técnicamente | Variantes, catálogo, destacados, filtros, diseños vinculados y rutas tienen cobertura Node. |
| V07 | Bloqueado por datos externos | Body está bloqueado por ausencia de variantes/precios públicos y producto remoto activo; no se inventaron valores. |
| V08 | Pendiente de usuario | Mujer y Body tienen geometría, bounds, normales, cierre y pruebas; faltan proporciones visuales aprobadas. |
| V09–V10 | Aprobado técnicamente | Mapeo rectangular/cuadrado por producto, cambios rápidos y fallback explícito están cubiertos. |
| V11–V12 | Pendiente de usuario | Volumen, superficie común y encuadre de tote tienen pruebas matemáticas; falta revisión de perfil, asas, giro y móvil. |
| V13 | Aprobado técnicamente / visual pendiente | Orden DOM, Frente único para tote, foco y scroll tienen pruebas de lógica; falta comprobación real en viewport. |
| V14 | Aprobado técnicamente | Mínimos elegibles, diseño restrictivo, variante inactiva y Body mensual están cubiertos. |
| V15 | Aprobado técnicamente / móvil pendiente | Giro de 12°/900 ms, cancelación, reduced motion y token de apertura están cubiertos. |
| V16 | Aprobado técnicamente / visual pendiente | Rerender conserva foco y scroll del contenedor identificado; falta medición DOM en breakpoints. |
| V17 | Pendiente de usuario | Requiere recorrido manual en 360/390 px, tablet, escritorio, orientación, tacto, teclado y desbordes. |
| V18 | Aprobado técnicamente en local | 102 pruebas, build, auditoría de contraste y diff limpio; checkout, email, Supabase remoto y sandbox de pago no se ejecutaron. |

Conclusión: la implementación local está técnicamente consistente, pero no se declara aceptación integral. Siguen abiertos la revisión visual V01–V04/V08/V11–V17, el catálogo remoto de Body y la validación contra un entorno de pruebas conectado. Cualquier publicación queda fuera hasta resolver esos pendientes.
