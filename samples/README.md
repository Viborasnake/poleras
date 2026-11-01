# Muestra de revelación progresiva

Con `npm run dev`, abrir `/samples/progressive-disclosure.html` en el puerto informado por Vite.

La muestra usa datos sintéticos y el DS del repositorio. No importa la aplicación principal, no consulta servicios externos, no guarda datos en localStorage y no realiza subidas ni compras. El borrador ficticio se genera en memoria al pulsar el control de evaluación. La ilustración reutiliza el archivo local `public/laika.png`.

En «Controles de evaluación» se puede alternar Progresiva/Todos los controles y Claro/Oscuro, reiniciar, recuperar un borrador incompatible y simular carga, error o falta de disponibilidad. Reintentar recupera las opciones de muestra; no consulta inventario real.

La página está disponible en desarrollo y deliberadamente fuera de las entradas del build de producción. Las pruebas de estado se ejecutan con `npm test`. El informe y las capturas están en [la evaluación](../docs/evaluations/progressive-disclosure.md).

Muestra aprobada visualmente por el usuario; el patrón compartido ya se está integrando en la tienda. Ver el plan para el alcance pendiente.


## Banco de pruebas de formularios públicos

Abrir `/samples/public-forms.html` con Vite. Usa los controladores compartidos de idea, mascota, contacto WhatsApp, checkout y Mis datos. «Ejecutar evaluación local» comprueba quince escenarios y muestra el resultado en la página; las acciones finales del banco son simulaciones locales. La foto usa el optimizador real del navegador cuando se elige un archivo, sin enviarlo a un servidor. Esta página tampoco forma parte del build de producción.

## Banco de formularios de catálogo administrativo

Ejecutar `node scripts/generate-admin-form-fixtures.mjs` y abrir `/samples/admin-forms.html` con Vite. El generador toma los templates reales de producto, colección y diseño y los renderiza con un catálogo ficticio. El banco no importa `admin.js`, no inicia sesión y no publica ni sube archivos. Usa `src/admin-form-disclosure.js`; el guardado final se sustituye por una simulación. El botón de evaluación comprueba quince escenarios; los archivos sintéticos comprueban metadatos/validación, no la decodificación ni la optimización remota. Regenerar las fixtures al cambiar los templates. La página queda fuera del build de producción.

## Banco de pedidos

Después de regenerar las fixtures, abrir `/samples/order-forms.html`. Usa el HTML real de pedido manual y edición, con datos ficticios. Los controladores y la ruta de captura se evalúan con un guardado simulado; no importa clientes de servidor ni crea pedidos o envía emails. Ejecutar evaluación local comprueba quince escenarios. Los handlers de opciones y líneas del banco son adaptadores locales; la prueba no acredita persistencia autenticada.

## Banco de insumos y recetas

Abrir `/samples/supplier-forms.html`. Ejecuta `renderSupplierProducts` completo con catálogo ficticio, cliente de datos simulado y almacenamiento de retorno en memoria; no importa el cliente real ni cambia su sesión. Gestionar insumos, edición, costos y recetas usan los handlers de producción. Ejecutar evaluación local comprueba quince escenarios, incluido crear/cancelar un componente sin perder la receta. Los guardados modifican únicamente la memoria de esta página; Reiniciar demo restaura los datos. Esta página queda fuera del build de producción.
