# Pedidos: alta progresiva y edición por secciones

19 de octubre de 2026. Entrega local de F10 y F11. No desplegada.

| Recorrido | Comportamiento |
| --- | --- |
| Pedido manual | Comprador/canal → entrega → productos confirmados uno por uno → datos de pago → notas opcionales → revisión. |
| Editar pedido | Resúmenes de cliente, entrega, productos y notas. Cambiar y confirmar solo lo necesario; comparación Antes/Después antes de guardar. La aprobación y el email posteriores mantienen el flujo existente. |
| Productos | Confirmar cada línea; editar invalida su confirmación. Las líneas anteriores se conservan y el subtotal se recalcula. Agregar requiere confirmar la línea pendiente. Se pueden quitar líneas mientras quede una; también las recién agregadas a una edición. |
| Entrega | Retiro omite destino. Despacho pide región, comuna y dirección. Alternar conserva el borrador. No se incorporó validación geográfica nueva al administrador. |
| Pago | Solo se revelan campos de métodos activos. Un enlace activo requiere URL válida; enviar instrucciones exige información de transferencia o enlace. Confirmar el bloque no cobra ni envía emails. |

`src/admin-order-disclosure.js` usa el adaptador de administración y el motor compartido. El listener de captura del alta manual pasa por la guardia y el bloqueo de duplicados antes de ejecutar el handler existente. El canal se incorpora a las notas del payload sin alterar el campo del borrador durante un intento fallido. Los payloads y la aprobación posterior mantienen su contrato.

## Verificación

- **15 escenarios de pedidos aprobados:** captura anticipada, confirmación del comprador, retiro/despacho, confirmación de líneas, agregar/quitar/reabrir, datos de pago, subtotal, duplicados, edición independiente, diferencias y datos ocultos inválidos. [Resultados](order-form-flows/browser-checks.txt).
- **30 regresiones aprobadas:** [15 de catálogo administrativo](order-form-flows/catalog-regression.txt) y [15 públicas](order-form-flows/public-regression.txt).
- **151 pruebas Node aprobadas**, 0 fallidas.
- **Build aprobado.** Conserva la advertencia de chunks mayores a 500 kB y el respaldo SEO por fallo de consulta remota; genera 16 páginas y sitemap.
- **Auditoría de pares de color aprobada.**
- **Móvil de 360 px:** página 360/360, formulario 322/322 y línea de producto 210/210 px de ancho visible/desplazable. Sin desborde horizontal. La preferencia temporal de viewport se restauró.

Repetición: `node scripts/generate-admin-form-fixtures.mjs`, Vite y `/samples/order-forms.html`; pulsar Ejecutar evaluación local. Las fixtures incluyen el HTML real y datos sintéticos. El banco reproduce la captura del submit y usa los controladores de producción, con adaptadores de opciones/agregar/quitar locales y una acción final simulada. No se inició sesión ni se crearon pedidos, modificaron registros o enviaron emails reales.

## Límites y pendientes

No se verificaron transacciones autenticadas, fallos parciales de persistencia de líneas ni retornos de email en el servidor. La evaluación local no sustituye esa prueba de integración. F12–F14 se integraron en la [entrega de insumos](supplier-form-flows.md). Siguen pendientes F17 (cupones), F18 (editor independiente de instrucciones de pago) y F19 (configuración), además de la verificación integral y lector de pantalla.

## Capturas

- [Edición: revisión Antes/Después](order-form-flows/edit-review.png).
- [Pedido manual: productos a 360 px](order-form-flows/manual-mobile.png).
