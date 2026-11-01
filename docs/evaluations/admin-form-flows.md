# Catálogo administrativo con revelación progresiva

19 de octubre de 2026. Implementación local, no desplegada. Continúa la muestra aprobada y la entrega de formularios públicos.

## Alcance implementado

| ID | Formulario | Secuencia |
| --- | --- | --- |
| F09 | Crear/editar diseño | Colección e identidad → productos y sus archivos → configuración de color → mockups opcionales → comportamiento y publicación → revisión. |
| F15 | Crear/editar colección | Producto y categoría → identidad → orden y visibilidad → revisión. Incluye la pill Nueva colección. |
| F16 | Crear/editar producto | Nombre y descripción → método de compra → opciones y visibilidad → revisión. |

Los inputs y archivos permanecen montados. Los valores precargados requieren confirmación; editar conserva las confirmaciones compatibles. Slug y orden se agrupan en Opciones avanzadas cuando corresponde. Los checkboxes de publicación muestran Sí/No y los archivos existentes se identifican como conservados. Los campos se restauran a sus posiciones originales antes de reiniciar el formulario al reabrirlo.

`src/admin-form-disclosure.js` compone el motor compartido. El guardado existente se mantiene: `adminFormData` habilita temporalmente solo los paneles del patrón, sin incluir archivos deshabilitados de productos no seleccionados. Durante el guardado se bloquean edición, avance, envío, cancelación y Escape. El error conserva los campos y permite reintento. No se sube ni publica al confirmar un bloque.

Se corrigieron dos problemas de validación: la expresión del slug ahora es compatible con el modo de patrones de HTML actual; el motor no añade un error personalizado persistente a un archivo o checkbox que simplemente falta, y usa su validación nativa. Se conserva el tratamiento de texto compuesto solo por espacios.

## Evaluación

| Comprobación | Resultado y límite |
| --- | --- |
| Banco administrativo | 15 escenarios aprobados. HTML real de los tres formularios, extraído por `scripts/generate-admin-form-fixtures.mjs` con catálogo sintético. Usa el controlador de producción; sustituye los handlers finales por simulaciones locales. |
| Regresión pública | Los 15 escenarios de `/samples/public-forms.html` siguen aprobados tras ajustar el motor compartido. |
| Pruebas Node | 151 aprobadas, 0 fallidas. |
| Build | Aprobado; conserva la advertencia de chunks >500 kB y el respaldo SEO local por fallo de consulta remota. |
| Colores | Auditoría de pares oficiales aprobada. La vista local usa estilos reales de administración y tokens del DS. |
| Móvil | Viewport de 360 px. Página 360/360 px y formulario 322/322 px de ancho visible/desplazable; sin desborde horizontal. Captura con bloque previo completado y método de compra abierto. |
| Panel real | `/admin` muestra el acceso autenticado. No se inició sesión, no se publicaron registros y no se subieron archivos. |

[Resultados de los 15 escenarios](admin-form-flows/browser-checks.txt). Para repetir: ejecutar `node scripts/generate-admin-form-fixtures.mjs`, iniciar Vite y abrir `/samples/admin-forms.html`; pulsar Ejecutar evaluación local.

Los archivos de los dos escenarios adicionales se crean en memoria y comprueban selección, confirmación, metadatos y serialización. No prueban decodificación de imágenes, optimización, subida a R2 ni persistencia en servidor. La política de archivos real sigue siendo la validación existente de administración.

## Pendientes

F10 y F11 se integraron en la siguiente entrega: [pedidos progresivos](order-form-flows.md).


F12–F14 se integraron en la [entrega de insumos](supplier-form-flows.md). Quedan F17–F19 (cupones, instrucciones de pago y configuración). Sigue pendiente la comprobación autenticada de crear/editar/publicar los tres formularios integrados, así como lector de pantalla y la revisión integral de todas las ramas. No se considera terminado el inventario F01–F19.

## Capturas

- [Producto: revisión antes de guardar](admin-form-flows/product-review.png).
- [Producto: memoria visual y siguiente bloque a 360 px](admin-form-flows/product-mobile.png).
