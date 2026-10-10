# Droska

Prototipo funcional de una tienda de poleras personalizadas, en español chileno. Marca: **Droska**.

## Documentación del proyecto

- **Este README** presenta el producto, cómo ejecutarlo y su estado funcional.
- El [design system](docs/design-system.md) desarrolla las reglas de color, tipografía, componentes, patrones y accesibilidad. Su catálogo visual está en `design-system.html` (ruta local `/design-system.html`).
- [`AGENTS.md`](AGENTS.md) es la entrada breve para GPT y otros agentes: indica qué documentos y archivos consultar antes de modificar la interfaz.

El DS es la referencia para nuevas interfaces de Droska. La matriz de contraste de su catálogo sirve para explorar pares técnicos; solo la lista de **pares oficiales** autoriza combinaciones de producto.

## Ejecutar

`npm install`, luego `npm run dev`. Para producción estática: `npm run build`; el resultado se genera en `dist/`.

## Supabase local

El frontend ya apunta al proyecto `dgndcklmmnnxyqfmnckh`. El bucket privado `customer-designs` y el esquema comercial inicial ya están configurados allí con RLS: perfiles, productos, variantes y precios en CLP, catálogo, carros, pedidos, estados y pagos. Los scripts [`supabase/storage-setup.sql`](supabase/storage-setup.sql), [`supabase/catalog-storage-setup.sql`](supabase/catalog-storage-setup.sql) y [`supabase/commerce-setup.sql`](supabase/commerce-setup.sql) registran la configuración reproducible de Storage y base de datos. `catalog-designs` es público para lectura CDN, pero solo una cuenta incluida en `private.admin_memberships` puede cargar, reemplazar o borrar sus archivos. No se requiere ni se expone una clave secreta o `service_role` en la web.

En local, puedes copiar [`.env.example`](.env.example) a `.env` para sobrescribir URL, clave publicable y `VITE_SITE_URL`. Vercel usa `npm run build` y `dist` según [`vercel.json`](vercel.json). En producción configura `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y la URL pública final en `VITE_SITE_URL`, además de la URL del sitio en la configuración de Supabase Auth. Crea también un **Deploy Hook** de Vercel para la rama de producción y guarda su URL como `VERCEL_DEPLOY_HOOK_URL`: es una variable exclusiva del servidor y nunca debe llevar el prefijo `VITE_`.

El seguimiento operativo usa la migración `order_status_workflow` y la Edge Function autenticada `update-order-status`. Para activarlo en un proyecto vinculado ejecuta `npx supabase db push` y `npx supabase functions deploy update-order-status`; configura como secretos `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (remitente de un dominio verificado) y `SITE_URL`. Ninguno debe llevar prefijo `VITE_`. Sin esos secretos el estado igualmente se actualiza y queda auditado, pero el panel avisa que el email no fue enviado.

La confirmación de cuentas y recuperación de contraseña usan Supabase Auth. Para que lleguen a clientes reales, configura Resend como SMTP personalizado y pega la plantilla de marca siguiendo [`docs/auth-email-setup.md`](docs/auth-email-setup.md). Es una configuración del Dashboard de Supabase: la API key no se expone en el frontend.

El panel de Administración incluye `Clientes`, que elimina una cuenta de Auth junto con perfil, carro, pedidos, pagos y archivos privados. Para habilitarlo en un proyecto vinculado despliega `npx supabase functions deploy admin-customer-accounts`; la función usa el secreto de servidor de Supabase y nunca expone `service_role` al navegador.

El build consulta el catálogo público de Supabase y genera HTML estático para cada nivel de la jerarquía: `/productos/{producto}/`, `/productos/{producto}/{coleccion}/` y `/productos/{producto}/{coleccion}/{diseno}/`. Cada página incluye canonical, descripción social, datos estructurados y una entrada en `sitemap.xml`; la ficha de diseño activa el visor 3D en el navegador y conserva una portada HTML si WebGL no está disponible. La portada enlaza esta navegación indexable solamente desde el footer: las cards mantienen el flujo comercial en modal/estudio. En desarrollo, Vite resuelve esas mismas rutas y consulta el contenido vigente. En producción, crear, editar, mostrar, ocultar o eliminar una colección o diseño desde el panel llama a `/api/rebuild-catalog`, valida nuevamente el rol administrador en Supabase y activa el Deploy Hook para regenerar las rutas y el sitemap.

## Administración local

El panel propio está en `/admin` (por ejemplo, `http://127.0.0.1:4178/admin`). Requiere una sesión autenticada y la membresía privada de administrador; no basta con conocer la URL. La primera administradora es `viborasnake@gmail.com`. El catálogo sigue la jerarquía **Producto → Colección → Diseño**. Los productos base son Poleras, Imanes y Afiches; cada colección se asigna a uno de ellos y cada diseño a una colección. El panel permite crear, editar, mostrar, ocultar y eliminar colecciones o diseños con confirmación y restricciones de integridad. Pedidos usa un Kanban operativo de tres columnas, permite registrar ventas presenciales y concentra cliente, despacho, contacto, historial y etiqueta imprimible en un modal. Cupones permite crear descuentos porcentuales o fijos con vigencia, compra mínima y límite de usos. La configuración reproducible del rol está en [`supabase/admin-setup.sql`](supabase/admin-setup.sql), la migración de jerarquía en [`supabase/catalog-product-hierarchy.sql`](supabase/catalog-product-hierarchy.sql) y la operación ampliada en [`supabase/migrations/20260927011431_admin_order_operations.sql`](supabase/migrations/20260927011431_admin_order_operations.sql).

Los archivos de catálogo admiten PNG, JPG y WebP de hasta 50 MB como origen. El panel conserva el original cuando ya cumple el límite; si supera 10 MB o 4.800 px en su lado mayor, lo redimensiona proporcionalmente y lo convierte a WebP antes de enviarlo al bucket público `catalog-designs`. Cada diseño exige además un color de polera de muestra; este valor alimenta su portada 3D y la selección inicial del estudio. También puede tener una foto de mockup de polera para su portada y una variante opcional para hover. Las migraciones reproducibles están en [`supabase/catalog-sample-color.sql`](supabase/catalog-sample-color.sql) y [`supabase/migrations/20261008195000_catalog_design_mockups.sql`](supabase/migrations/20261008195000_catalog_design_mockups.sql).

## Implementado

- Portada adaptable, caminos creativos, catálogo local de prediseñadas por colección, explicación del proceso y preguntas frecuentes.
- Las colecciones iniciales contienen diseños originales de muestra. Al elegir uno, se carga y muestra sobre la polera 3D desde el primer paso del estudio. El motivo y su color quedan bloqueados; se elige modelo, talla y ubicación al frente o la espalda. «Para el bebé» es temática: aún no hay prenda ni talla de bebé disponible.
- Carga local de JPG/PNG/WEBP con validación de tipo, decodificación y límite de 50 MB.
- Guardado opcional de diseños en el bucket privado de Supabase Storage para cuentas autenticadas, con cargas TUS por partes y reintentos de hasta 50 MB y recuperación del último archivo por cara. No se envía nada a Storage hasta pulsar «Guardar en mi cuenta».
- Área privada de cliente con “Mis pedidos” (stepper en tiempo real desde pedido ingresado hasta entrega, historial, fecha, total, destino y detalle) y “Mis datos” (nombre, email, teléfono y dirección de despacho). Administración avanza un pedido de a una etapa; el cambio queda auditado, se refleja por Realtime respetando RLS y dispara un email transaccional cuando Resend está configurado.
- Poleras básica, oversize y niños, selección de talla y color. El catálogo consulta los precios base activos desde Supabase; conserva valores de referencia locales si no hay conexión.
- Modelo GLB de polera con pliegues, cuello, mangas y textura de tela; rotación manual con Three.js y estampado proyectado sobre la malla mediante DecalGeometry. Vista frontal inicial e iluminación mate. Es una referencia visual, no una simulación física del calce o impresión; oversize y niños son cortes derivados de la misma malla. Oversize mantiene apoyo en el pecho y se abre gradualmente hacia la basta, con pliegues amplios y dobladillos suaves.
- Laika se carga como diseño de muestra por defecto (`public/laika.webp`) para que el visor no abra vacío; al subir otro archivo se reemplaza y se ejecuta la validación técnica.
- Resumen de precio base y mitad correspondiente. Diseño y entrega pendientes de cotización; el abono definitivo se calcula sobre el total aprobado.
- Borrador local eliminable en navegador. Los archivos quedan en IndexedDB durante 15 días; si el cliente elige guardarlos en su cuenta, también se envían a su carpeta privada de Supabase. Al iniciar un pago, los originales de los artículos personalizados se suben al bucket privado para poder producir el pedido. Quitar un archivo del estudio borra la copia local, no la copia remota.
- Checkout Pro de Mercado Pago: una Edge Function recalcula el total en servidor, crea el pedido pendiente y la preferencia de pago; el webhook firmado consulta el pago y solo entonces marca el pedido como pagado. Rechazos, cancelaciones y pagos pendientes permanecen visibles en el historial y bloquean producción; el cliente puede volver a intentarlo sin perder el carro. La transferencia bancaria también crea un pago pendiente, entrega instrucciones desde secretos de servidor, permite avisar el pago desde la cuenta y exige confirmación auditada de administración. Los diseños propios del carro se guardan por artículo y se suben al bucket privado antes de iniciar el pago; el servidor verifica los archivos y registra sus rutas, color y revisión técnica. El panel de administración permite descargar los originales mediante enlaces firmados de corta duración. El retorno del navegador es informativo y no confirma pagos por sí solo. Aún se requiere una compra de prueba antes de aceptar cobros reales.

## Pendiente para operar comercialmente

### Solicitudes creativas y avisos

Para activar el recorrido “Tengo una idea”, aplica `supabase/migrations/20261010201544_creative_request_reliability.sql` y despliega `create-design-request`, `create-creative-payment`, `send-order-email` y `mercado-pago-webhook`. Configura `ADMIN_ORDER_EMAIL` como secreto de Edge Functions junto con `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SITE_URL` y los secretos de Mercado Pago. Las referencias se guardan en `customer-designs/{usuario}/reference/` y solo se abren desde administración mediante enlaces firmados. Una cotización guardada se envía al cliente; en “Mis pedidos” puede aceptarla y continuar a Mercado Pago. Hasta aplicar la migración y desplegar las funciones, este recorrido no funcionará en producción.

El recurso `public/shirt.glb` proviene del proyecto `Starklord17/threejs-t-shirt`; su licencia MIT y atribución se incluyen en `public/shirt-LICENSE.txt`.

El diálogo de confirmación usa el [logo oficial RGB de Mercado Pago](https://www.mercadopago.com.ar/mp/logo-oficial), guardado localmente en `public/mercado-pago-logo.svg`. La URL pública de la tienda es `https://droska.frontbook.cl`: úsala para `VITE_SITE_URL` en el build web y para `SITE_URL` en Supabase. Para activar los cobros configura `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` como secretos de las Edge Functions, aplica la migración y despliega `create-payment-preference`, `mercado-pago-webhook` y `update-order-status`. Esta integración de Checkout Pro no usa Public Key, Client ID ni Client Secret. Configura en el panel de Mercado Pago el Webhook de **Pagos** con URL `https://dgndcklmmnnxyqfmnckh.supabase.co/functions/v1/mercado-pago-webhook`; la firma secreta debe corresponder a esa configuración. El token y la firma nunca se exponen al navegador. Para habilitar transferencia desde el checkout agrega también `BANK_TRANSFER_HOLDER`, `BANK_TRANSFER_BANK`, `BANK_TRANSFER_ACCOUNT_TYPE`, `BANK_TRANSFER_ACCOUNT_NUMBER`, `BANK_TRANSFER_RUT` y, si corresponde, `BANK_TRANSFER_EMAIL` como secretos de Edge Functions. En un proyecto vinculado:

```bash
npx supabase db push
npx supabase functions deploy create-payment-preference
npx supabase functions deploy mercado-pago-webhook --no-verify-jwt
npx supabase functions deploy update-order-status
```

Carga los secretos desde el Dashboard de Supabase, en **Edge Functions → Secrets**. Para desarrollo local, usa un archivo ignorado `supabase/functions/.env` con esas mismas variables. Prueba primero con credenciales y cuentas de prueba de Mercado Pago antes de habilitar producción.

### Alcance del backend de la tienda

Supabase será el backend de la operación completa, no solo de los archivos. Debe administrar cuentas y perfiles, colecciones y productos, variantes y disponibilidad, lista de precios y cargos vigentes, diseños privados, carros y pedidos, cotizaciones y revisiones del taller, estados, pagos confirmados por webhooks, y trazabilidad de los cambios. Las personas podrán consultar únicamente sus datos y pedidos; el personal del taller tendrá permisos diferenciados. La primera estructura y sus políticas RLS viven en [`supabase/commerce-setup.sql`](supabase/commerce-setup.sql); la creación final de pedidos, cambios de estado y pagos queda reservada para una Edge Function de confianza.

Los precios que aparecen en `src/main.js` y `src/print-check.js` siguen siendo referencias visuales; la Edge Function calcula el total desde precios vigentes, guarda la instantánea aceptada y el webhook verifica el monto antes de marcar un pedido como pagado. El cliente nunca decide el importe final ni confirma pagos. El carro actual en `localStorage` tampoco constituye un pedido persistente.

Completar el panel del taller para cotizar, subir propuestas y gestionar revisiones; configurar proveedor de pago y webhooks verificados para abono del 50% y saldo; definir guía de tallas, disponibilidad, entrega y condiciones comerciales. El seguimiento operativo y la notificación por email ya están implementados; requieren aplicar la migración, desplegar la Edge Function y cargar los secretos de Resend. `vercel.json` prepara el build Vite para un despliegue futuro, pero no se ha modificado DNS.

Flujo previsto: borrador → solicitud enviada → cotización aprobada → abono confirmado → diseño en trabajo → propuesta disponible → aprobación del cliente → saldo confirmado → impresión → entrega. Los importes y transiciones deben validarse en servidor; nunca confiar en localStorage o en importes enviados por el navegador.
