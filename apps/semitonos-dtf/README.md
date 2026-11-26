# Trama DTF Lab

Aplicación web local para convertir diseños en semitonos listos para impresión DTF.

Aplicación publicada: https://droska.frontbook.cl/herramientas/semitonos-dtf/

La aplicación forma parte del repositorio de Droska y se compila con la ruta base `/herramientas/semitonos-dtf/`. Las imágenes y proyectos se procesan localmente en el navegador; no se suben al repositorio.

## Rango de color (cambio local)

En **Eliminar fondo → Gotero · Color del sustrato…**, haz clic en el original para seleccionar el color real del fondo. Puedes añadir hasta ocho colores, editar o quitar cada muestra por separado y recuperar el último cambio con Deshacer. Ajusta Tolerancia y Suavidad junto a las muestras. Los diálogos de trama y protección usan los mismos controles y conservan los trazos al quitar colores. La máscara muestra en blanco lo que se elimina, en negro lo que se conserva y en gris las transiciones; también puedes previsualizar el recorte sin semitono. Cancelar no modifica el diseño.

Al aplicar se activa Color personalizado, sin modificar los modos Negro y Blanco. La selección global se calcula desde los colores originales remuestreados, antes de las correcciones, y su máscara no se puede rellenar con Conservar detalle, brillo o inversión. Los colores no seleccionados se conservan; con ajustes neutros y tamaño 100%, el semitono actúa sobre las transiciones de transparencia, no perfora uniformemente todo el interior. El rango queda incluido en el historial, el autoguardado, los presets personalizados y el documento editable de Gang Sheet. La tolerancia usa distancia RGB, no la escala propietaria de Photoshop. Puede eliminar detalles interiores del mismo color: no es selección semántica ni eliminación exclusiva de fondo conectado.

## Desarrollo local

Requiere Node.js 24 y npm. El procesamiento de imágenes ocurre en el navegador; no necesita claves API ni backend.

Desde la raíz del repositorio de Droska:

```bash
npm install
npm run dev:semitonos
```

## Compilar

Desde la raíz del repositorio, `npm run build` compila la tienda y deja este editor en `dist/herramientas/semitonos-dtf/`.

## Funciones

- Carga de PNG, JPG, WebP y SVG por selector o arrastrando el archivo.
- Trama configurable por frecuencia (LPI), ángulo, forma y tamaño de punto.
- Eliminación de negro (prenda negra), blanco o sin eliminación de fondo.
- Ajustes de brillo, contraste y umbral de sombras/blancos.
- Resultado en color o monocromo, con opción de inversión.
- Comparación interactiva original/resultado.
- Exportación PNG con transparencia.
- Trama por píxel, conservación de detalles y eliminación del color de fondo de los bordes. Los semitonos usan alfa binario en todo el PNG.
- Vista sobre damero y prendas negra, blanca, gris, azul marino, azul oscuro, café oscuro o rojo fuerte; el fondo de vista previa no se incluye en el PNG.
- Escala manual en porcentaje y botones 100%, 200%, 300% y 400%.
- Ancho/alto en centímetros con proporciones bloqueadas; 150, 300 o 600 ppp.
- Ampliación Lanczos-3 con colores ponderados por alfa y nitidez adicional de 0 a 100%.
- Presets organizados por **Prenda oscura / Prenda clara → Semitono / Sin semitono**. Cambiar de grupo aplica su primera opción; cada preset establece explícitamente trama, fondo y ajustes de imagen, conservando tamaño, ppp, recorte y bordes. Los presets personales siguen disponibles en «Mis presets».

| Prenda | Acabado | Presets incluidos |
| --- | --- | --- |
| Oscura | Semitono | Equilibrado (32 LPI), Trama fina (45 LPI), Trama marcada (24 LPI), Reducir ruido (45 LPI, limpieza 35%), Un color (blanco, 45 LPI) |
| Oscura | Sin semitono | Color original, Quitar negro, Un color (blanco) |
| Clara | Semitono | Trama tonal (32 LPI, detalle 0%), Trama fina (45 LPI, detalle 30%), Trama marcada (24 LPI), Reducir ruido (45 LPI, limpieza 35%), Un color (negro, 45 LPI) |
| Clara | Sin semitono | Color original, Quitar fondo blanco, Un color (negro) |

Son puntos de partida, no perfiles de impresión certificados. Negro y blanco son los fondos de referencia; sobre prendas de otros colores la apariencia cambia. «Color original» no elimina fondo y conserva el alfa original. «Quitar negro» afecta a todos los negros y mantiene la tinta visible opaca sin generar puntos. Se recomienda una prueba física con el proveedor.

**Trama marcada** hace más visible el patrón con 24 LPI y cobertura tonal neutra. **Reducir ruido** atenúa residuos de color cercanos al negro o al blanco mediante limpieza al 35%; también puede reducir detalle real en esas zonas. En blanco utiliza detalle 0% para conservar la trama tonal. Los cinco presets de semitono conservan tamaño físico, ppp, recorte y bordes; puedes afinar sus controles y guardarlos como preset propio.

**Un color** convierte todos los píxeles impresos a blanco para prenda oscura o negro para clara. Con semitono genera puntos opacos. En modo continuo, los presets de un color mantienen la tinta visible opaca. Conserva las transparencias del original y elimina el fondo negro/blanco según la categoría. No es una limpieza selectiva de ruido en imágenes a color: también convierte sus colores reales. Los presets a color no cambian.

- Correcciones automáticas: Tono automático, Contraste automático y Color automático. Son reversibles, combinables y se calculan a partir del original antes de la trama.
- Flujo recomendado desde Gang Sheet: nombrar trabajo y escoger formato, importar para ajustar, enviar al Gang Sheet, repetir y exportar.
- Guardar preset con nombre: almacena los ajustes de trama, color, fondo, nitidez y bordes en este navegador. Aparecen en “Mis presets” al recargar. No incluye imagen, tamaño ni zoom; los nombres repetidos reciben un sufijo para conservar los anteriores.
- “Enviar a Gang Sheet” añade el resultado procesado a la plancha y la abre; el botón también está visible en pantallas pequeñas.
- Desvanecido y eliminación de margen en milímetros, por lado. El selector ofrece 18 máscaras orgánicas, texturizadas y geométricas. La profundidad de la máscara y su patrón se ajustan a la resolución de salida.
- Zoom independiente del tamaño de impresión, 100% real y Ajustar a pantalla, siempre accesibles.
- Herramienta Mano junto al zoom: arrastra para desplazarte por una imagen ampliada. Atajos: mantener Espacio o arrastrar con el botón central. Desactiva Mano para volver a arrastrar el divisor de comparación.
- Gang Sheet: diseños desde el editor o imágenes importadas, copias, tamaño proporcional, separación, margen y giro opcional. «Optimizar plancha» prueba más distribuciones para colocar la mayor cantidad de copias y reducir el alto ocupado. Conserva los tamaños definidos y se puede deshacer.

Para un diseño con fondo negro, selecciona **Eliminar fondo → Negro**. Ajusta **Eliminar sombras** hasta quitar el fondo conservando los detalles. Esta operación afecta a los negros de toda la imagen, incluidos los del interior del dibujo. Revisa el resultado sobre una prenda negra y usa el damero para comprobar los huecos transparentes.

Para semitono sobre blanco, selecciona **Prenda clara → Semitono → Trama tonal**: 32 LPI, tamaño 100%, gamma 1, umbral 255, puntos opacos y detalle 0%. La cobertura varía con el tono. **Trama fina** usa 45 LPI y detalle 30%. El control **Conservar detalle** refuerza la cobertura proporcionalmente al tono y compensa el color para conservar aproximadamente el promedio sobre blanco con ajustes neutros. Ya no impone una cobertura mínima casi sólida: incluso al 100% conserva variación tonal. Para color continuo, elige **Sin semitono**. El cambio afecta al cálculo sobre blanco, incluido el gotero con base blanca; no modifica el modo negro. Los proyectos guardados conservan sus valores, pero su semitono blanco se recalcula con la curva corregida; los PNG ya generados no cambian automáticamente.

Los semitonos aplican alfa sólido a cada píxel de tinta, incluidas las zonas protegidas y las máscaras de borde. Los huecos conservan alfa 0 y la tinta usa alfa 255. En Sin semitono puedes elegir alfa continuo o sólido. Aumentar tamaño, gamma o densidad de tinta puede oscurecer el resultado; subir LPI cambia la frecuencia, no es por sí solo un control de oscuridad.

En **Semitono → Solo franja de contorno** puedes tramar la silueta exterior del diseño sin fondo. También puedes activar **Contorno exterior automático** desde el diálogo **Dónde aplicar trama**. Elige el lado y un ancho de 1 a 20 píxeles de salida. La fluidez afina puntas y giros. El suavizado hace que los puntos se unan a la tinta sólida gradualmente y se abran hacia la transparencia. El modo exterior suma un margen al PNG conservando la escala del dibujo. El ajuste se guarda con el proyecto y con el original editable del Gang Sheet.

En semitono a color, **Eliminar fondo → Limpiar ruido en sombras** (negro) o **Limpiar ruido en blancos** (blanco global) atenúa los puntos cromáticos residuales cercanos al fondo. La intensidad va de 0 a 100%; **0% está apagado y conserva exactamente el procesamiento anterior**. Reduce cobertura y amplificación de color solo en tonos próximos al negro/blanco, sin desaturar globalmente. No distingue ruido de detalle real: al subirla puede quitar sombras profundas o detalles claros, incluido pelaje. No actúa en «Un color», sin semitono ni eliminación blanca conectada al borde. Se guarda en presets y proyectos; cambiar a un preset incluido vuelve a 0%.

**Prenda clara → Sin semitono → Quitar fondo blanco** retira únicamente los tonos claros conectados al borde y conserva colores interiores. El umbral controla qué tonos se consideran fondo; si el pelaje claro conecta con el exterior, también puede eliminarse. La vista de prenda por sí sola no cambia el procesamiento.

Pruebas del motor:

```bash
npm test
```

## Proyecto y autoguardado

Al iniciar sin un proyecto activo, escribe su nombre o abre un `.trama.json`. El proyecto se guarda automáticamente en **este navegador y esta dirección**, incluyendo el editor, originales disponibles, ajustes, recortes, categoría de prenda y Gang Sheet. Al volver se recupera el último guardado. La cabecera indica cambios pendientes, guardando, guardado o error; espera la confirmación antes de cerrar.

Al enviar un diseño al Gang Sheet se guardan sus ajustes de semitono, el preset seleccionado y su fondo de vista previa. «Editar original» recupera esos valores junto con el recorte y la resolución. Para guardar los cambios en la plancha, usa «Revisar y actualizar Gang Sheet». Si el preset personal ya no está en «Mis presets», los valores guardados se abren como «Personalizado».

**No se sobrescribe automáticamente un archivo del disco.** Usa **Descargar proyecto** para una copia portable y **Abrir proyecto** para retomarla. Borrar los datos del navegador, usar otro navegador/dirección o cerrar antes de completar el guardado puede hacer perder cambios. «Nuevo proyecto» sustituye el autoguardado activo tras confirmación; descarga antes una copia para conservarlo. La apertura acepta proyectos de hasta 1 GB; el límite evita congelar el navegador al cargar archivos excesivos.

En «Mis presets», selecciona uno para **Renombrar preset** o **Eliminar preset**. Eliminar exige confirmación, no es reversible y no modifica los ajustes de la imagen abierta. Los presets incluidos no se pueden borrar.

Los controles de trama se ocultan en «Sin semitono». Las intensidades automáticas aparecen solo al activar su corrección; escala por porcentaje y ajustes avanzados permanecen disponibles en desplegables. No se descartan ajustes por ocultar un control.

## Tamaño y exportación

El tamaño se calcula como `píxeles = cm / 2,54 × ppp`, redondeado al píxel más cercano. El remuestreo ocurre **antes** del semitono, cuya frecuencia usa la resolución elegida. La exportación incluye un bloque PNG `pHYs` con esa resolución, reemplazando los 96 ppp habituales del canvas. Cuando se solicita la descarga, el mensaje indica las dimensiones en píxeles y los ppp del PNG. Algunos RIP ignoran los metadatos, por lo que conviene comprobar allí los centímetros indicados.

El editor acepta salidas de hasta 40 megapíxeles y 12.000 px por lado. En Gang Sheet, el ancho llega a 300 cm y el PNG admite hasta 600 megapíxeles y 70.866 px por lado. A 300 ppp se pueden exportar, por ejemplo, planchas de 58 × 300 cm y 300 × 130 cm. La exportación de planchas grandes genera el PNG por franjas y conserva la resolución elegida. Si las medidas superan un límite, el editor muestra el motivo y bloquea la exportación. El procesamiento de trama y remuestreo se ejecuta en un Web Worker cancelable.

La escala 200% duplica ancho y alto en píxeles (cuadruplica el área). La ampliación conserva y remuestrea el detalle disponible; no utiliza IA ni reproduce Photoshop Preserve Details 2.0, y no puede recuperar información ausente. Subir nitidez en exceso puede producir halos. Revisar al 100%.

En Gang Sheet, los diseños se colocan como imágenes rasterizadas. Cambiar allí el tamaño de un semitono ya generado cambia también su LPI efectivo; para mantener la frecuencia deseada, establecer primero el tamaño en el editor y añadir ese resultado a la plancha. Las imágenes importadas no reciben eliminación automática de fondo. Las copias que no caben bloquean la exportación para evitar omisiones.
