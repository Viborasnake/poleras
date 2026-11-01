# Insumos y recetas con revelación progresiva

Entrega local de F12, F13 y F14. No desplegada.

| Recorrido | Resultado |
| --- | --- |
| Gestionar insumos | Acción → grupo → elección de insumo al editar. Precargas sin confirmar, contador de búsqueda, resumen editable y selección explícita. Crear y Categorías omiten la selección existente. |
| Crear/editar insumo | Identidad → compra/costo → dimensiones o producción cuando corresponde → estado → revisión. Campos inactivos excluidos de validación y sin alterar su borrador compatible. |
| Unidad/pack | Costo efectivo actualizado por unidad. Pack exige cantidad válida; la revisión conserva precio y cantidad de compra. |
| DTF/principal | DTF confirma pliego y tamaño máximo. Principal confirma dimensiones, costos adicionales, margen e IVA. Los demás tipos resuelven dimensiones como No aplica. |
| Receta | Componentes con resumen y edición. Cada línea nueva/modificada se confirma; agregar se bloquea mientras haya una pendiente. Total acumulado, duplicados y rendimiento DTF validado antes de guardar. |
| Crear componente desde receta | Cancelar devuelve el borrador. Guardar restaura las cantidades y agrega la línea nueva pendiente de confirmación. Los fallos de guardado conservan datos y permiten reintento. |

El adaptador usa los primitives y motores existentes. La aplicabilidad de un bloque puede cambiar al elegir otra categoría o forma de compra. Los campos siguen montados; confirmar no escribe en servidor. La lectura del guardado sigue usando los campos y cálculos originales. Las fórmulas de costos, rendimiento, margen e IVA no se modificaron.

El retorno de receta amplía el mecanismo de sesión ya existente: conserva IDs de componentes y cantidades junto al principal y el nuevo componente. El módulo permite inyectar ese almacenamiento para que el banco no toque el retorno de una sesión real. En producción mantiene el almacenamiento de sesión predeterminado.

## Verificación

- **15 escenarios de insumos aprobados**, ejecutando el módulo completo y sus handlers con cliente de datos y almacenamiento en memoria. Incluye unidad/pack, DTF, principal, búsqueda, categorías, duplicados, espera, fallo/reintento y ambos retornos desde crear componente. [Resultados](supplier-form-flows/browser-checks.txt).
- **45 regresiones aprobadas:** [pedidos](supplier-form-flows/order-regression.txt), [catálogo administrativo](supplier-form-flows/catalog-regression.txt) y [formularios públicos](supplier-form-flows/public-regression.txt), 15 casos cada uno.
- **151 pruebas Node aprobadas**, 0 fallidas.
- **Build aprobado.** Conserva la advertencia de chunks mayores a 500 kB y el respaldo SEO por fallo de consulta remota; genera 16 páginas y sitemap.
- **Auditoría de colores aprobada.**
- **Móvil de 360 px:** diálogo y formulario de insumo 322/322 px; diálogo y formulario de receta 322/322 px de ancho visible/desplazable. Sin desborde horizontal. Se restauró el viewport al terminar.

Repetir con Vite en `/samples/supplier-forms.html`, botón Ejecutar evaluación local. Los guardados de la muestra modifican solo el catálogo en memoria; Reiniciar demo restaura sus datos. No se inició sesión, no se tocaron registros ni se enviaron notificaciones reales.

## Límites y pendientes

La evaluación no acredita persistencia autenticada, políticas de acceso, concurrencia, errores parciales de servidor ni recuperación de sesión después de recargar el navegador. El retorno tras refrescar datos sí se comprobó con el cliente simulado y el render real del módulo. La vista móvil no sustituye la revisión con lector de pantalla.

F17–F19 están integrados: cupón, editor independiente de instrucciones de pago y configuración usan el mismo adaptador de revelación progresiva en el panel real. Falta la verificación integral con una sesión administrativa y servicios remotos disponibles; no se declara completa esa comprobación autenticada.

## Capturas

- [Pack: resumen y costo efectivo antes de guardar](supplier-form-flows/pack-review.png).
- [Compra del pack a 360 px](supplier-form-flows/pack-mobile.png).
- [Receta y costo acumulado a 360 px](supplier-form-flows/recipe-mobile.png).
