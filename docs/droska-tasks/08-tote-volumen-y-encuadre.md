# I08 · Volumen textil y encuadre de tote bag

Modelo: **gpt-6.1-sol · High**. Fase 3. **T7 + T8 juntas**. Dependencia: I05 para verificación de arte correcto.

## 1. Objetivo específico

Dar profundidad y pliegues a la base/laterales de la tote y priorizar el estampado al abrir, conservando exploración del producto completo.

## 2. Contexto técnico mínimo

Lee [reglas](README.md), C7 y T7/T8 del [plan](../../PLAN_DROSKA.md). `toteSurface()` define panel e impresión; cuerpo M es aprox. 1.5×1.71 unidades, asas llegan a y≈2.07. Cámara/target inicial y `face`/`reset` usan y=.54; impresión se centra cerca de -.11. DS anterior pide bolsa casi plana, pero el usuario pide volumen: actualizar esa regla al implementar, sin pedir nueva autorización por ese conflicto.

## 3. Archivos involucrados

`src/tote-viewer.js`: `toteSurface`, `createToteGeometry`, asas/bandas/costuras, colocación de impresión, `resize`, cámara, `face`, `reset`. `src/tote-viewer.test.js`; `src/main.js` solo si `faceSelectedSide` requiere ajuste mínimo. `docs/design-system.md`.

## 4. Instrucciones de implementación

1. Definir un perfil suave de profundidad y pliegues inferiores que conserve cuerpo, boca y asas. Mantener área central imprimible continua; no aplicar grosor uniforme que convierta la bolsa en caja.
2. Usar misma superficie/transformación para tela y arte, normales actualizadas y separación pequeña sin flotación/z-fighting. Conservar relación M/L y corregir costuras/base si cambia su apoyo.
3. Enfocar inicialmente el cuerpo/zona imprimible; permitir recorte parcial de asas. Revisar cámara y target juntos, también `face` y `reset`, para que otra acción no vuelva a encuadre antiguo.
4. Adaptar distancia al aspect ratio sin encoger innecesariamente el estampado en móvil. Mantener zoom/órbita suficientes para recuperar producto completo, sin habilitar impresión trasera.
5. Reutilizar loop, observers y disposal; registrar cantidad de geometría antes/después y evitar aumentar segmentos sin necesidad. Actualizar DS con volumen y encuadre; dejar revisión de apariencia al usuario.

## 5. Restricciones

No rediseñar asas/material/paleta si no lo exige la nueva geometría. No mover solo una imagen plana independiente. No añadir un visor distinto, girar automáticamente todavía ni habilitar Espalda como ubicación. No renderizados/capturas de inspección.

## 6. Pruebas

Profundidad de base positiva y superior al perfil anterior donde corresponda; continuidad lateral/central, índices/normales/bounds finitos, M/L, superficie de impresión coincidente. Comprobar matemáticamente encuadre de zona imprimible por aspect ratio y consistencia de reset/face. `npm test`, build. Usuario verifica perfil, base, asas, frente, giro y móvil.

## 7. Criterios de aceptación / Definition of Done

T7/T8 tienen geometría/cámara coherentes y pruebas; V11/V12 quedan sujetos a confirmación visual del usuario. El modelo completo sigue explorable y el estampado no se separa. Siguiente **I09**.

## Resultado I08 · 14 de octubre de 2026

Volumen inferior/lateral y pliegues suaves añadidos a `toteSurface()` sin aumentar malla (9.490 vértices, 18.848 triángulos). El arte usa esa misma superficie en M/L, frente/espalda explorables; la ubicación comercial sigue siendo solo Frente. Cámara, `face()` y `reset()` centran el estampado y ajustan distancia según ancho de vista. `npm test` (98/98), `npm run build` y `git diff --check` correctos; el build SEO usó el catálogo local porque falló la consulta remota en este entorno. Revisión visual pendiente del usuario, sin capturas automáticas. Siguiente **I09**.
