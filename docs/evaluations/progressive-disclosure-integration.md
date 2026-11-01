# Primera integración de revelación progresiva

19 de octubre de 2026. La muestra fue aprobada por el usuario y se autorizó continuar. Integración local de Detalles y del patrón compartido; no se ha desplegado ni se ha completado la migración de todos los formularios.

## Implementación

- `src/progressive-disclosure.js`: motor de confirmaciones separado de los valores precargados, revalidación por valor y disponibilidad, resolución de opciones únicas, estado de carga/error y primitive de bloques con resúmenes editables.
- `src/main.js`: Producto → Modelo → Talla/Edad → Color/Tela → Ubicación → Archivo cuando corresponde. El producto y precio se leen de las variantes vigentes; el canal sigue determinando si los archivos se cargan en web o se adjuntan por WhatsApp.
- El bloque Archivo se revisa antes de continuar; la carga no avanza automáticamente. El estampado solo por espalda exige el archivo de esa cara, sin exigir incorrectamente uno frontal adicional.
- El borrador guarda confirmaciones versionadas junto a la configuración. Cambiar producto, modelo o disponibilidad invalida solo respuestas que cambiaron o dejaron de ser válidas. Un error transitorio de consulta bloquea el avance y conserva las confirmaciones. Crear una idea nueva reinicia la secuencia.
- Los paneles plegados usan `hidden` y un fieldset deshabilitado: no participan del foco ni bloquean la validación nativa. Foco al encabezado siguiente al elegir; foco en Editar al expandir. Sin animación ni scroll suave con movimiento reducido.
- El visor 3D mantiene su host y su actualización habitual. Se actualizó el DS con el primitive, un ejemplo interactivo y el espécimen de composición; los steppers del catálogo ahora reflejan las tres etapas generales vigentes.

## Evidencia de verificación

| Comprobación | Resultado |
| --- | --- |
| Flujo real con datos disponibles | Se eligió Polera unisex → Básica → Mediana → Beige → Frente. Solo se abría la decisión activa; Ver resumen quedó habilitado y el precio mostrado fue $15.990. |
| Edición real compatible | Editar Talla abrió el bloque conservando foco en Editar; elegir Grande conservó Beige y Frente y mantuvo Ver resumen habilitado. |
| Resumen real | Ver resumen presentó Básica, Grande, Beige, Frente y $15.990; el canal vigente mostró contacto para WhatsApp. No se envió una solicitud. |
| Visor real | Se observó la polera 3D con el marcador «Tu diseño» y el color elegido mientras se editaban los controles. |
| Ejemplo compartido en DS | Enter confirmó Producto; Espacio confirmó Mediana. Beige se resolvió como única opción; la selección quedó completa y el foco pasó a Reiniciar ejemplo. |
| Error real de consulta | Tras recargas posteriores, fallaron las consultas remotas de variantes y catálogo. La interfaz presentó Reintentar carga, mantuvo pendientes y bloqueó Ver resumen. El reintento siguió fallando. |
| Layout de error observado | Se midieron 1043 px de viewport; el diálogo y su contenido no tenían desborde horizontal interno. No se presenta esta medición como prueba móvil: el cambio de viewport de la herramienta se aplicó a otra pestaña. |
| Dependencias y guardado | Ocho pruebas nuevas del motor: preselecciones, requisitos, opción única, edición compatible, sustitución de variante, versión de borrador, archivo obligatorio y conservación ante fallo transitorio. |

Las comprobaciones del flujo real se realizaron antes de los últimos ajustes de estado/error y de reset de idea. Esos ajustes pasaron pruebas y build; la repetición completa quedó limitada por las consultas remotas fallidas. No se atribuye la caída de consulta a esta implementación ni se declara validado el recorrido completo de catálogo mientras no se pueda volver a ejecutar.

## Comandos

- `npm test`: 149 pruebas aprobadas.
- `npm run build`: aprobado; advertencia de chunks mayores a 500 kB. El generador SEO usó respaldo local por `fetch failed` y produjo 16 páginas y sitemap.
- `npm run audit:a11y-colors`: aprobado para los pares oficiales del DS.
- `node --check`: archivos JS nuevos/modificados válidos.
- `git diff --check`: sin errores de espacios.

## Límites y siguiente entrega

Pendientes de comprobación: apertura con diseño de catálogo/mascota, todas las familias de producto, carga real local por cara y restauración completa tras recarga con datos remotos disponibles, responsive del estudio integrado en todos los rangos, preferencia de movimiento reducido activada y lector de pantalla. No se afirma conformidad completa de accesibilidad a partir de la inspección del árbol accesible.

El patrón aún debe extenderse a foto/contacto de mascota, Tengo una idea, contacto WhatsApp, checkout, Mis datos y formularios administrativos según el plan F01–F19. Esta entrega corresponde al motor/DS y a Detalles; no cierra el inventario completo.

## Capturas

- [Ejemplo interactivo del primitive en el DS](progressive-disclosure-integration/ds-modelo.png).
- [Bloqueo seguro del estudio ante fallo de consulta](progressive-disclosure-integration/error-desktop.png).
