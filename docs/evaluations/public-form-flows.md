# Solicitudes, contacto y checkout progresivos

19 de octubre de 2026. Segunda entrega local tras la aprobación de la muestra. No desplegada.

## Cambios implementados

| Recorrido | Comportamiento |
| --- | --- |
| Tengo una idea | Idea → referencias opcionales → contacto → revisión → acción final. Al editar conserva los campos y las referencias compatibles. |
| Mascota, ruta web | Foto validada/optimizada → nombre e indicaciones opcionales → contacto → revisión. Terminar de optimizar no avanza el formulario. |
| Mascota, WhatsApp | Confirmar la instrucción de foto pendiente de adjuntar en el chat → opcionales → contacto → revisión. No pide cargar una foto web. |
| Compra WhatsApp | Contacto confirmado → resumen de producto → acción final. Los campos se conservan al volver. |
| Checkout | Contacto → modalidad → región → comuna → dirección si despacho → revisión. Retiro omite dirección; regresar a despacho conserva los valores y exige revisarlos. |
| Mis datos | Resúmenes independientes de información y dirección; editar una sección, revisar cambios y guardar explícitamente. Región habilita comuna y comuna habilita dirección. Cambiar región conserva la dirección y limpia una comuna incompatible. |
| Opcionales | Referencias se pueden confirmar vacías; departamento, indicaciones y cupón se despliegan a petición. |

Los controles comparten `src/form-disclosure.js` y `src/public-form-flows.js`, sobre el motor existente. Los inputs permanecen montados al escribir, confirmar o editar. Los paneles cerrados quedan fuera del foco y validación nativa; la guardia de envío revisa también esos datos. La revisión aparece antes del CTA. Los mensajes no afirman guardado remoto.

La foto y las referencias se mantienen bloqueadas mientras se optimizan. Las solicitudes creativas y de WhatsApp bloquean controles/cierre durante la preparación; los errores recuperan las acciones. No se cambiaron los payloads ni se desplegaron servicios.

## Verificación realizada

| Nivel | Evidencia |
| --- | --- |
| Tienda real, Tengo una idea | Se escribió una idea ficticia; no avanzó al escribir y el envío siguió deshabilitado. Continuar reveló referencias, luego contacto. Datos de prueba válidos no habilitaron el envío hasta confirmar el bloque. La revisión quedó antes del CTA. No se ejecutó el envío final. |
| Tienda real, móvil | Vista de 360 px: diálogo `322/322 px` y contenido `254/254 px` de ancho visible/desplazable. Sin desborde horizontal interno. Se revisó y corrigió el contraste de Continuar en modo oscuro. |
| Foto real local | Se eligió `public/pet-reference-dog.webp` en el banco. El optimizador informó «pet-reference-dog.webp · optimizada»; el bloque activo siguió siendo Foto y el CTA final continuó bloqueado. No se envió la foto. |
| Controladores compartidos, banco local | Quince escenarios aprobados, incluidos el foco al alternar retiro/despacho y la guardia de submit anticipado. El banco usa el HTML de mascota y los controladores de la tienda; los datos y el HTML base de checkout son fixtures locales. |
| Catálogo del DS | Ejemplo de campos comprobado: Nombre → Contacto → revisión → confirmación local. No guarda datos. |
| Pruebas de Node | 151 aprobadas. Se agregaron contratos de cambio despacho/retiro y confirmación explícita de referencias opcionales. |
| Build | Aprobado. Conserva la advertencia de chunks mayores a 500 kB y usa respaldo SEO local por `fetch failed`; genera 16 páginas y sitemap. |
| Auditoría de colores | Pares oficiales del DS aprobados. No equivale por sí sola a una auditoría de todos los controles. |

### Escenarios del banco

1. Escribir no avanza ni habilita el envío; contacto futuro no participa en la validación nativa.
2. Idea → referencias omitidas → contacto válido → revisión antes del CTA; rechaza email inválido.
3. Editar idea exige confirmación y conserva contacto compatible.
4. Resumen abreviado conserva íntegros el campo original y la revisión final.
5. Foto obligatoria y bloqueo durante optimización; terminar no confirma automáticamente.
6. WhatsApp mantiene la foto pendiente de adjuntar en el chat.
7. Checkout precargado requiere confirmación; retiro omite dirección y deja el foco en el CTA.
8. Volver a despacho conserva dirección y abre Región con foco correcto.
9. Cambiar región elimina una comuna incompatible y obliga a revisar dirección.
10. Acción final del banco produce solo una simulación local.
11. Contacto de mascota exige confirmación aun con campos válidos.
12. Guardia final bloquea submit anticipado y datos ocultos que dejaron de ser válidos.
13. Mis datos: editar teléfono no exige confirmar dirección y serializa los campos de paneles cerrados.
14. Mis datos: región/comuna compatibles, dirección conservada, bloqueo durante guardado y reintento.
15. Mis datos: no cambia de sección con cambios sin revisar ni acepta alteraciones ocultas.

[Resultados del navegador](public-form-flows/browser-checks.txt). Banco reproducible con Vite: `/samples/public-forms.html`, botón «Ejecutar evaluación local».

El controlador de Mis datos se probó con perfiles ficticios del banco local. No se inició sesión ni se modificó un perfil real. El adaptador serializa explícitamente todos los campos, incluidos los paneles cerrados, antes de llamar al guardado existente.

## Límites y trabajo pendiente

El catálogo y las variantes remotas siguen fallando en este entorno. No se verificó el recorrido completo de checkout con inventario real, la selección de mascota desde un diseño publicado ni los envíos/retornos de pago reales. La composición de checkout se evaluó con fixtures y los mismos controladores; no se presenta como prueba de servidor ni de integración comercial completa.

Siguen pendientes los formularios administrativos (F09–F19), revisión integral de todas las ramas, lector de pantalla y la comprobación con preferencia de movimiento reducido activada. Las decisiones de solicitudes/contacto se conservan en memoria al navegar; no se incorporó persistencia nueva de datos personales.

## Capturas

- [Idea, inicio real](public-form-flows/idea-inicio.png).
- [Idea, revisión antes de enviar](public-form-flows/idea-revision.png).
- [Idea, 360 px y Continuar visible en oscuro](public-form-flows/idea-mobile.png).

- [Mis datos, resúmenes independientes en el banco local](public-form-flows/account-sections.png).
