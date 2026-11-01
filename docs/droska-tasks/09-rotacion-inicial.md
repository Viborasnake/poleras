# I09 · Giro introductorio del estudio

Modelo: **gpt-6-luna · Medium**. Fase 3. T12. Dependencias: I07/I08.

## 1. Objetivo específico

Comunicar que el producto es interactivo con un movimiento breve que cede inmediatamente al usuario.

## 2. Contexto técnico mínimo

Lee [reglas](README.md) y C7/T12 del [plan](../../PLAN_DROSKA.md). Ambos visores ya tienen loop, OrbitControls, `turn`, `face`, `reset` y `dispose`. `renderStep` y `syncPreview` se repiten al cambiar opciones; no son señal suficiente para disparar animación. `garment.js` también se usa en hero/mockups.

## 3. Archivos involucrados

`src/main.js`: apertura/cierre de `#studio`, `openStudio`, `viewerVersion`, creación del visor. `src/garment.js` y `src/tote-viewer.js`: loop, eventos de interacción, visibilidad y cleanup. `docs/design-system.md`. Prueba de lógica temporal/cancelación mínima si se extrae helper justificado.

## 4. Instrucciones de implementación

1. Definir token de sesión por apertura efectiva del estudio y comenzar solo con modelo listo. Propuesta inicial: oscilación ≤12°, duración ≤900 ms, vuelve al encuadre pertinente sin salto.
2. Una vez por apertura, no por cambio de color, talla, carga o rerender. Si el usuario ya interactuó antes de terminar la carga, no iniciar giro después. No disparar en hero, portadas ni pantallas sin visor visible.
3. Cancelar ante pointer/gesto o teclado de interacción, cierre, documento oculto y `prefers-reduced-motion`. Movimiento reducido: cero giro; mantener información textual accesible de que se puede explorar.
4. Usar loop existente y tiempo transcurrido, no velocidad por frame ni otro loop permanente. No sobrescribir la cámara que el usuario acaba de manipular al cancelar.
5. Limpiar listeners/estado en dispose y conservar comportamiento al reabrir. Comprobar que nueva cámara de tote permanece válida; actualizar DS.

## 5. Restricciones

No autoRotate infinito, tours, zoom automático, dependencias de animación, movimiento de hero ni entradas redundantes. No usar capturas para verificar el giro. Parámetros visuales sujetos a revisión del usuario.

## 6. Pruebas

Simular reloj/apertura/carga/reentrada: una sola ejecución, cancelación antes/durante, cierre durante carga, reduced motion inicial y sobrevenido, pestaña oculta y restauración, cambio de talla/color. Reaperturas sin acumulación de listeners. `npm test`, build; usuario valida suavidad móvil y protagonismo del diseño.

## 7. Criterios de aceptación / Definition of Done

V15 cumple reglas temporales, cancelación y reduced motion; sin costo de loop adicional. Revisión móvil visual pendiente del usuario si aún no la realiza. Siguiente **I10**.

## Resultado I09 · 14 de octubre de 2026

Implementado `createIntroTurn()` con oscilación de 12°/900 ms, una vez por apertura efectiva de `#studio`. La carga asíncrona conserva el token de sesión y no inicia el movimiento después de una interacción previa. Se cancela ante gesto, teclas de navegación, cierre, pestaña oculta y movimiento reducido; `turn(0)` deja el frente estable. Validación: `npm test` (100/100); build y revisión visual quedan para el cierre de la unidad. Sin capturas automatizadas. Siguiente **I10**.
