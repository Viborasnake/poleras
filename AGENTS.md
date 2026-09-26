# Contexto del proyecto para GPT

Este repositorio contiene el prototipo web de **Droska**, una tienda de poleras personalizadas en español chileno. Empieza por [README.md](README.md) para entender el producto, sus comandos y qué está implementado.

## Diseño e interfaz

- Lee [docs/design-system.md](docs/design-system.md) antes de crear o modificar componentes, estilos, textos de interfaz o patrones responsive.
- Consulta el catálogo ejecutable en `design-system.html` (`/design-system.html` con Vite). Los tokens y primitives compartidos están en `src/design-system.css`; `src/design-system-page.css` y `src/design-system-page.js` implementan el catálogo, no sustituyen la lógica de producto.
- Usa roles semánticos de color y las combinaciones oficiales documentadas. Que un par pase el explorador de contraste no lo convierte en combinación de marca aprobada.
- Mantén estados y controles utilizables con teclado, etiquetas visibles y la referencia WCAG 2.0 AA indicada en el DS.

## Trabajo en el repositorio

- La app principal entra por `index.html` y `src/main.js`; el DS entra por `design-system.html`. Vite configura ambas entradas en `vite.config.js`.
- Antes de entregar cambios, ejecuta `npm run build` y las pruebas pertinentes (`npm test`; para colores, `npm run audit:a11y-colors`).
- Actualiza `docs/design-system.md` cuando cambie una regla del DS; actualiza este archivo solo si cambian las instrucciones de entrada para agentes. No copies el DS completo aquí ni en el README.
