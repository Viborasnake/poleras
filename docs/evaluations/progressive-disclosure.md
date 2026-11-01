# Evaluación de la muestra de revelación progresiva

19 de octubre de 2026. Muestra local aprobada visualmente por el usuario. Este informe conserva la evaluación de la muestra; la integración posterior se documenta [por separado](progressive-disclosure-integration.md).

## Acceso y alcance

Ejecutar `npm run dev` y abrir `/samples/progressive-disclosure.html` en el puerto informado. En esta sesión: http://127.0.0.1:4183/samples/progressive-disclosure.html.

Recorrido comprobado: elegir producto, modelo, talla, color y ubicación → mantener resumen editable → pasar a la simulación de mascota → volver conservando datos. Todos los valores son sintéticos. El estado vive en memoria; no se envía información ni se persiste remotamente. «Restaurar borrador ficticio» genera un ejemplo con una talla incompatible para evaluar la recuperación.

La página es independiente de `src/main.js` y no se incorporó como entrada del build de producción. Esta evaluación cubre el sample, no la integración con el visor 3D, inventario, archivos, checkout o backend reales.

## Resultados

| Caso del plan | Resultado | Evidencia y límites |
| --- | --- | --- |
| E01 · Secuencia | Pasa | Navegación de producto a ubicación en navegador; foco en el siguiente encabezado y resúmenes persistentes. La referencia «Todos los controles» expone cinco paneles con los mismos datos. |
| E02 · Preselección | Pasa | Inicio en 0/5 con CTA bloqueado pese a valores iniciales internos. Borrador ficticio revalidado antes de permitir continuar. Pruebas de estado incluidas. |
| E03 · Única opción | Pasa | Básica + Mediana resuelve Beige automáticamente y abre Ubicación, pasando de 2/5 a 4/5. Precio de demostración exacto $15.990. |
| E04 · Edición compatible | Pasa | Cambio de Mediana a Grande mantiene Beige, Frente y CTA habilitado. Comprobado en navegador y prueba de estado. |
| E05 · Dependencia incompatible | Pasa | Básica/Mediana → Oversize marca solo Talla como pendiente, mueve el foco a ese bloque y bloquea continuar; conserva color y ubicación. También probado al cambiar producto. |
| E06 · Error y disponibilidad | Pasa | Error, falta de disponibilidad y carga simulada bloquean el CTA. Reintentar conserva datos y recupera el estado. Se corrigió la recuperación cuando el bloqueo ocurre sobre un color único ya completado. |
| E07 · Teclado y foco | Pasa en comprobaciones realizadas | Flecha derecha no cambia 0/5; Enter y Espacio confirman; foco pasa a Modelo, Talla, Ubicación y Continuar. Editar mantiene foco en su control. Pendiente una pasada completa con lector de pantalla y orden de tabulación exhaustivo. |
| E08 · Responsive y movimiento | Parcial | Navegador a 360, 768 y 1440 px: ancho del documento coincide con el viewport, sin scroll horizontal. Capturas revisadas en móvil oscuro y tablet claro. CSS y scroll respetan `prefers-reduced-motion`; queda pendiente verificarlo con esa preferencia activada. |
| E09 · Resumen y retorno | Pasa | Paso simulado presenta Polera unisex, Básica, Mediana, Beige y Frente; Volver conserva 5/5 y precio. |
| E10 · Guardado comunicado | Pasa | Inicio y reinicio indican selección solo en la muestra. Recuperación identifica «Borrador ficticio revalidado»; no anuncia guardado remoto. |

La muestra fue aceptada visualmente por el usuario y se autorizó continuar. E08 conserva su estado parcial como registro técnico; la prueba con preferencia de movimiento reducido y la pasada con lector de pantalla siguen pendientes de comprobación manual, sin afirmar conformidad completa.

## Verificación del repositorio

- `npm test`: **141 pruebas aprobadas**, incluidas siete nuevas sobre preselección, avance, edición, invalidación, bloqueo y restauración de la muestra.
- `npm run build`: **aprobado**. Advertencia de chunks mayores a 500 kB; generación SEO con respaldo local porque la consulta de catálogo falló (`fetch failed`), generando 16 páginas y sitemap. El sample se verificó en Vite/navegador porque está fuera del build de producción.
- `npm run audit:a11y-colors`: **aprobado** para los pares del DS. No sustituye una auditoría automática de todos los elementos del sample; la muestra consume los tokens del DS y se revisó visualmente.
- Sin cambios en lógica ni formularios de compra reales. Sin comparación Sol/Astra ejecutada: sigue siendo opcional; no hay resultados de rendimiento o consumo entre modelos.

## Capturas

| Estado | Evidencia |
| --- | --- |
| Inicio de escritorio | [Ver captura](progressive-disclosure/01-inicio.png) |
| Avance con producto, modelo y talla resumidos | [Ver captura](progressive-disclosure/02-avance.png) |
| Selección completa | [Ver captura](progressive-disclosure/03-resumen.png) |
| Editar una talla previa | [Ver captura](progressive-disclosure/04-edicion.png) |
| Inicio móvil, 360 px | [Ver captura](progressive-disclosure/01-inicio-mobile.png) |
| Tablet claro, 768 px | [Ver captura](progressive-disclosure/05-tablet-claro.png) |
| Vista completa de comparación, 1440 px | [Ver captura](progressive-disclosure/06-comparacion.png) |
| Cambio que requiere revisar talla | [Ver captura](progressive-disclosure/07-incompatible.png) |

La captura de tablet corresponde a la revisión inicial; posteriormente se ajustó el reintento para volver al resumen cuando no quedan decisiones pendientes.
