# I07 · Polera mujer y body de bebé en 3D

Modelo: **gpt-6.1-sol · High**. Fase 3. T6 + geometría/referencias de T4. Dependencias: I04 para body e I05 para arte. Dos entregables internos verificables, en secuencia.

## 1. Objetivo específico

Representar claramente una polera femenina y un body de bebé, manteniendo materiales, estampado y controles coherentes con Droska.

## 2. Contexto técnico mínimo

Lee [reglas](README.md), C4/C7 y T4/T6 del [plan](../../PLAN_DROSKA.md). `woman` existe comercialmente pero no tiene rama en `createGarmentCut`. El visor activo es `garment.js`, no `viewer.js`. Body tiene topología distinta: una camiseta pequeña no representa el cierre inferior. El usuario hace las revisiones visuales; la investigación de referencias no debe convertirse en capturas/análisis visual automatizado.

## 3. Archivos involucrados

`src/garment-cuts.js`, `src/garment.js` (`getCut`, área de impresión, material, API y disposal), `src/garment-cuts.test.js`, `src/garment-decal.test.js`, `src/artwork-fit.js`/tests; `src/main.js` solo `syncPreview`/selección del visor y textos de fallback para body. `public/shirt.glb`/`public/shirt-LICENSE.txt` como base existente, sin sobrescribir. `docs/design-system.md`. Un archivo geométrico nuevo solo si la topología del body lo exige: documentar nombre real al crearlo, no asumir asset externo disponible.

## 4. Instrucciones de implementación

1. Investigar referencias reales de body básico y polera femenina: primero medidas/fichas del proveedor verificado, luego fabricante apropiado si falta información. Registrar URLs, medidas y limitaciones/licencia; no descargar/copiar un modelo comercial sin permiso. No abrir galerías ni analizar capturas. El usuario evalúa referencias y proporciones visuales.
2. Implementar primero `woman` mediante corte de la base cuando sea viable: cintura, torso, hombros y mangas diferenciados sin deformar cuello ni aplicar escalado uniforme. Recalcular normales/bounds y mantener simetría útil sin borrar pliegues existentes.
3. Implementar body con cuello/mangas y silueta corporal infantil, aperturas de piernas y cierre inferior característico. Elegir geometría propia mínima compatible con Three.js si el GLB no admite esa topología; no reutilizar `kids` como resultado final.
4. Reutilizar material y API del visor (`update`, `resize`, `face`, `reset`, `turn`, `dispose`). Integrar selección de I04, fallback específico y versionado/cancelación de cargas. No perder WebGL fallback cuando falle la carga.
5. Definir área imprimible por prenda/cara, lejos de cuello, mangas, costuras y cierre. Mantener aspecto, alfa y contención del arte; no declarar medidas de estampado físico sin respaldo administrativo.
6. Verificar básica/oversize/niños sin alterar su geometría. Actualizar DS con las reglas de nuevas prendas y C7 con referencias, parámetros y límites. Entregar comparación que el usuario debe revisar por su cuenta.

## 5. Restricciones

Sin nuevos motores 3D, simulación de tela, normalización que borre proporciones o cámara global que afecte todo el catálogo. No modificar precio/tallas ni guía de medidas a partir de una malla aproximada. Sin screenshots/renders para inspección del agente. No considerar T4 completa sin geometría y aceptación comercial.

## 6. Pruebas

Bounds finitos, normales válidas, identidad geométrica distinta, cintura/hombro/manga medibles; preservación de base; cuerpo body y aperturas sin geometría degenerada. Proyección frontal/trasera, artes ancho/alto/transparente, escala/cambio de modelo y cleanup. Ampliar tests de cortes/decal con propiedades útiles; `npm test`, build. Usuario revisa frente, perfil, espalda, cuello y cierre, arte y experiencia móvil.

## 7. Criterios de aceptación / Definition of Done

Código y pruebas diferencian Mujer y Body sin regresión de otros cortes, y modelos están integrados. Referencias investigadas y registradas, aprobación visual **pendiente del usuario** hasta recibirla. Con I04–I06 y esa aceptación se cierra T4; no publicar antes. Siguiente **I08**.

## Resultado I07 · 14 de octubre de 2026

Implementación local: corte `woman` derivado del GLB; Body propio en `src/body-geometry.js`, con aperturas y cierre inferior. `src/garment.js` integra ambos con la API existente y define áreas imprimibles separadas. La referencia y sus límites figuran en C7 del plan. El Body continúa bloqueado comercialmente por variantes/precios faltantes y revisión visual pendiente. Sin capturas ni revisión visual automatizada.

Validación: `npm test` (95/95), `npm run build` y `git diff --check`. El build usó el catálogo local de respaldo porque la consulta remota falló en este entorno. Siguiente unidad: **I08**.
