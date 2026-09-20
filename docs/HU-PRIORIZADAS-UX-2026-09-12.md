# Historias de usuario priorizadas · UX droska SHIRT

Fuente: [Auditoría UX](UX-AUDIT-2026-09-12.md), 12 de septiembre de 2026.

Estas historias convierten los 16 hallazgos del audit en entregables de producto. La prioridad combina impacto en completar la personalización, preservación del trabajo y accesibilidad. La secuencia propuesta evita construir mejoras sobre el flujo inestable actual.

| Prioridad | HU | Resultado esperado | Hallazgos fuente |
| --- | --- | --- | --- |
| P0 | HU-01 | Diseños por cara seguros | 01, 04, 05 |
| P0 | HU-02 | Borrador recuperable | 02 |
| P0 | HU-03 | Validación de impresión coherente | 06, 09 |
| P1 | HU-04 | Ruta «Mi idea» completa | 07 |
| P1 | HU-05 | Revisión final fiel a la configuración | 08, 16 |
| P1 | HU-06 | Estudio visible y usable en todos los tamaños | 03, 10 |
| P1 | HU-07 | Configurador accesible por teclado y lector | 11, 12 |
| P2 | HU-08 | Carga inicial rápida y sin tarjetas vacías | 13 |
| P2 | HU-09 | Expectativas claras del modo demostración | 14 |
| P2 | HU-10 | Espacio de borradores consistente con la marca | 15 |

## P0 · Debe resolverse antes de ampliar el flujo

### HU-01 · Gestionar estampados por cara sin perder trabajo

**Como** persona que personaliza una polera, **quiero** elegir Frente, Espalda o Ambas y gestionar el archivo de cada cara por separado, **para** saber qué se imprimirá y no perder un diseño al cargar o reemplazar otro.

**Criterios de aceptación**

- La elección es explícita: Frente, Espalda o Ambas.
- Cada cara incluida muestra su archivo, resultado de validación y acciones Reemplazar y Quitar.
- Cargar, reemplazar o quitar una espalda no modifica ni invalida el frente, y viceversa.
- Al cargar una cara, el visor enfoca ese lado y muestra su diseño o un error recuperable si no puede renderizarlo.
- No se puede continuar si una cara incluida no tiene un archivo válido; el mensaje identifica la cara que falta.
- El resumen enumera exactamente las caras incluidas y sus recargos, cuando existan.

**Dependencias:** ninguna.  
**Trazabilidad:** audit 01, 04 y 05.

### HU-02 · Guardar y retomar un borrador local

**Como** persona que no termina de configurar su polera, **quiero** guardar y recuperar mi borrador local, **para** continuar después sin repetir las decisiones ya tomadas.

**Criterios de aceptación**

- Existe una entrada visible a «Mi borrador» desde la portada o el estudio cuando hay un borrador local.
- Tras recargar, puedo recuperar modalidad, brief, tipo de prenda, talla, color, caras seleccionadas y escala de estampado.
- Antes de guardar se informa que las imágenes no se almacenan y deberán adjuntarse otra vez al retomar.
- Al reabrir, cada imagen pendiente se identifica por cara sin borrar el resto de la configuración.
- Si solo se admite un borrador, se avisa antes de reemplazar el existente y se puede eliminar de forma explícita.

**Dependencias:** HU-01 para persistir la selección de caras de forma consistente.  
**Trazabilidad:** audit 02.

### HU-03 · Validar la impresión según el tamaño efectivo

**Como** persona que sube un diseño, **quiero** que su evaluación técnica use el tamaño de estampado que elegí, **para** evitar una revisión innecesaria y entender si el archivo sirve para imprimir.

**Criterios de aceptación**

- La interfaz muestra ancho, alto y ppp efectivos para el lado y la escala seleccionados.
- Cambiar la escala vuelve a calcular resolución y actualiza la recomendación sin recargar el archivo.
- Si un archivo mejora de insuficiente a válido al reducirlo, se ofrece volver a «Tengo diseño» y se reactiva el 3D.
- Una revisión seleccionada por decisión de la persona se distingue de una revisión activada por baja resolución.
- El resumen final conserva las dimensiones aprobadas de cada cara.

**Dependencias:** HU-01, porque la evaluación debe pertenecer a cada cara.  
**Trazabilidad:** audit 06 y 09.

## P1 · Completar un configurador confiable y accesible

### HU-04 · Adjuntar referencias en «Mi idea»

**Como** persona que parte desde una idea, **quiero** describirla y adjuntar una referencia opcional desde la misma ruta, **para** pedir una propuesta sin cambiar de modalidad.

**Criterios de aceptación**

- La ruta «Mi idea» explica una sola propuesta de valor coherente: describir una idea y, opcionalmente, adjuntar referencias.
- Permite adjuntar, reemplazar y quitar una o más referencias dentro de esa ruta.
- Si no hay referencia, el estado visual está vacío y no muestra imágenes de ejemplo como si fueran del cliente.
- Esta modalidad no promete una previsualización 3D de impresión si no la ofrece.

**Dependencias:** ninguna.  
**Trazabilidad:** audit 07.

### HU-05 · Revisar una configuración completa antes de guardar

**Como** persona que termina mi configuración, **quiero** revisar todos los atributos reales de mi solicitud, **para** detectar cambios o cobros antes de guardar el borrador.

**Criterios de aceptación**

- El resumen muestra prenda, talla, color, caras, archivos o referencias, dimensiones, brief y precio base.
- Cargar una imagen no cambia el color elegido; si se sugiere mejor contraste, la persona decide aplicarlo o ignorarlo.
- El pago simulado se asocia a la versión actual de la solicitud y se reinicia al cambiar datos que la invaliden.
- El texto y la tarjeta del borrador identifican cualquier aprobación como simulada, sin describirla como pago o crédito real.

**Dependencias:** HU-01 y HU-03.  
**Trazabilidad:** audit 08 y 16.

### HU-06 · Usar el estudio sin recortes ni pasos duplicados

**Como** persona que configura una polera desde escritorio o teléfono, **quiero** completar el estudio con controles visibles y una secuencia simple, **para** no perder acciones ni repetir decisiones.

**Criterios de aceptación**

- Cada decisión se toma una sola vez: diseño o referencias, prenda y ajuste, luego revisión.
- En 1280 × 720, el visor, «Ver lado elegido» y la acción principal se ven completos.
- En 820 × 900, los botones de navegación no se desbordan; se apilan cuando no caben.
- En 390 × 844, cargar un archivo está disponible antes de un visor que no monopoliza la primera pantalla.
- Los controles de tamaño solo aparecen cuando modifican una previsualización visible.

**Dependencias:** HU-01, porque el orden de caras forma parte del recorrido.  
**Trazabilidad:** audit 03 y 10.

### HU-07 · Configurar la polera con teclado y tecnologías asistivas

**Como** persona que navega con teclado o lector de pantalla, **quiero** entender y operar cada selección del estudio, **para** completar la personalización sin depender de un mouse o del arrastre 3D.

**Criterios de aceptación**

- Activar modo, prenda, talla, color o cara mantiene el foco en el control equivalente y comunica la selección.
- Los grupos de opciones tienen nombre y estado semántico; el paso actual se anuncia.
- Los diálogos tienen nombre accesible y devuelven el foco al disparador al cerrarse.
- Las zonas de carga tienen foco visible; la ayuda es legible sin ampliar y las áreas táctiles son adecuadas para móvil.
- El visor tiene una alternativa de orientación por controles, además de arrastrar.
- Se verifica el recorrido completo con Tab, Shift+Tab, Enter y Espacio.

**Dependencias:** HU-06 para evitar que el diseño responsivo oculte controles.  
**Trazabilidad:** audit 11 y 12.

## P2 · Mejoras de calidad antes de exponer el prototipo a más personas

### HU-08 · Cargar la portada con contenido de muestra eficiente

**Como** visitante en una conexión móvil, **quiero** ver una portada útil mientras las muestras 3D se preparan, **para** no gastar datos ni enfrentar tarjetas vacías.

**Criterios de aceptación**

- La primera vista no inicia las tres imágenes originales de muestra ni los visores de tarjetas fuera de pantalla.
- Las tarjetas muestran una imagen estática o fallback mientras el 3D carga o falla.
- Las muestras se optimizan para el tamaño en que se muestran y los visores diferidos se cargan al acercarse a pantalla.
- Se miden transferencia inicial y carga en red móvil simulada antes y después del cambio.

**Dependencias:** ninguna.  
**Trazabilidad:** audit 13.

### HU-09 · Explicar el alcance de la demostración desde el inicio

**Como** visitante, **quiero** saber antes de empezar si el estudio crea un pedido real, **para** decidir cuánto tiempo dedicarle y no interpretar el simulador como un cobro.

**Criterios de aceptación**

- Antes de cargar o describir una idea se muestra una nota breve de que se trata de una demostración local.
- La llamada final usa «Guardar borrador de prueba» u otra etiqueta coherente con su efecto.
- El simulador mantiene visible que no cobra ni registra pagos reales.

**Dependencias:** ninguna.  
**Trazabilidad:** audit 14.

### HU-10 · Presentar el borrador con una identidad de marca coherente

**Como** persona que abre mi borrador, **quiero** reconocer que es mi trabajo local dentro de droska SHIRT, **para** no confundirlo con la cuenta o perfil de otra persona.

**Criterios de aceptación**

- El espacio usa de forma consistente la marca droska SHIRT.
- La cabecera identifica «Tu borrador en este navegador» y no muestra un perfil ficticio de Cristian.
- La historia del fundador permanece solo en su contexto editorial de la portada.

**Dependencias:** HU-02.  
**Trazabilidad:** audit 15.

## Orden de implementación

1. HU-01 y HU-02: preservar configuraciones e imágenes; son los bloqueadores del recorrido.
2. HU-03: evitar que la validación empuje erróneamente a revisión.
3. HU-04 a HU-07: cerrar las rutas de entrada, la revisión, el responsive y la accesibilidad.
4. HU-08 a HU-10: mejorar rendimiento, transparencia y consistencia de marca.

## Fuera de alcance de estas HU

Estas historias mantienen el prototipo como demostración local. Integración de cuentas, almacenamiento permanente de imágenes, precios finales, pagos reales, pedidos al taller, stock, guía de tallas, despacho y condiciones comerciales requieren historias separadas y decisiones de negocio.
