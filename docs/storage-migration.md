# Migración del catálogo a Cloudflare R2

Estado: R2, la zona de Cloudflare y `images.frontbook.cl` están activos. Los 137 archivos públicos se copiaron a R2 y la tienda resuelve sus rutas históricas desde ese dominio. Los originales de Supabase se mantienen temporalmente como respaldo; no se han eliminado archivos remotos.

## Inventario diagnóstico del 17 de octubre de 2026

Consulta de metadatos de Supabase, no respaldo de los archivos:

| Bucket | Archivos | Bytes |
| --- | ---: | ---: |
| catalog-designs (público) | 137 | 396455769 |
| customer-designs (privado) | 14 | 110143984 |

Los 137 archivos públicos son PNG; 107 tienen max-age=3600 y 30 max-age=259200. Hay 28 archivos (78832693 bytes) sin coincidencia en los campos examinados de catálogo y order_items.catalog_artwork_path. No implica que sean eliminables: faltan referencias externas, versiones publicadas y respaldo.

## Primera corrección

La preparación de portadas 3D omite diseños con foto editorial y diseños inactivos antes de descargar originales o crear el renderizador. Las vistas generadas se reutilizan durante la sesión; un cambio de archivo, producto o color invalida la vista. Esto no modifica el original que usa el estudio o la producción.

Pendiente: generación bajo demanda por visibilidad, fotos principales diferidas y hover por interacción; derivados WebP; medición de red en navegador y producción.

## Activación de infraestructura

1. Completar el inventario de DNS de `frontbook.cl` antes de cambiar los nameservers. La zona en cPanel/BenzaHosting contiene 103 registros, incluidos correo, validaciones TLS, Droska, tienda y otros subdominios.
2. Crear un bucket R2 Standard para el catálogo público y conectar el dominio. r2.dev se reserva para pruebas.
3. Configurar CORS para los orígenes reales de tienda y administración; validar lectura con canvas/WebGL. Las credenciales de escritura quedan solo en servidor, con alcance al bucket.
4. Implementar un endpoint que compruebe sesión y rol administrador antes de autorizar cada carga. Conservar Supabase para datos y archivos privados.

## Estado de DNS de `frontbook.cl`

Cloudflare asignó estos nameservers, que reemplazarán los cuatro de BenzaHosting solo después de confirmar DNSSEC y hacer la delegación en NIC Chile:

- `cortney.ns.cloudflare.com`
- `stan.ns.cloudflare.com`

La exploración inicial de Cloudflare importó una parte de la zona. Se verificaron y añadieron los registros necesarios para Droska, todos en modo **DNS only**:

- `droska` CNAME hacia Vercel.
- `resend._domainkey.droska` TXT (DKIM).
- `rsend.droska` CNAME.
- `send.droska` CNAME.

Los 74 registros faltantes se importaron mediante `docs/frontbook-cl-missing-records.zone`; Cloudflare confirmó **103 de 200** registros, el mismo total del inventario de cPanel. Todos quedaron como **DNS only**. En NIC Chile se verificó que DNSSEC no estaba habilitado y se cambiaron los nameservers por `cortney.ns.cloudflare.com` y `stan.ns.cloudflare.com`. Cloudflare está verificando la delegación; puede tardar 1–2 horas, excepcionalmente hasta 24. No se deben activar nubes proxy para correo, CNAME de validación, SRV, TXT o los hosts de cPanel.

Secuencia segura: completar registros faltantes en Cloudflare → comparar los 103 registros contra cPanel → probar resolución de web/correo → cambiar nameservers en NIC Chile → esperar la activación de Cloudflare → volver a probar todos los servicios. No se elimina la zona de BenzaHosting durante el cambio.

## Copia y cambio de referencias

Exportar un manifiesto completo y respaldo local de originales públicos, con bytes y SHA-256; conservar copia de las referencias actuales. Crear derivados web sin sobrescribir originales de impresión. Copiar a R2 con rutas versionadas y verificar hash, tipo, CORS y caché. Adaptar administración, catálogo y build antes del cambio. Mantener las URLs históricas usadas por pedidos. No usar reemplazos globales de dominio sin validar las rutas.

Validar primero un diseño y después todo el catálogo, incluyendo creación, edición, visor, checkout y descarga desde pedidos. Reversión: restaurar las referencias del manifiesto y el proveedor de subida previo. Mantener los archivos fuente durante la transición.

## Subidas nuevas y transición

La administración publica directamente en R2 a través de la función `sync-catalog-design`: el navegador no recibe credenciales de Cloudflare, la función exige una sesión de administrador y solo acepta JPG, PNG o WebP optimizados con extensión coherente. El límite es 900 KB para fotos de mockup y 3 MB para archivos de estampado. El panel acepta como origen JPEG, PNG o WebP de hasta 25 MB. Los mockups conservan hasta 2.400 px; 1.500 × 1.000 px es la recomendación de nitidez, no un requisito de publicación. El arte imprimible preserva hasta 2.400 px. Prefiere WebP y, si el navegador no puede codificarlo, usa un codificador WebP local compatible con transparencias; JPEG o PNG son el último respaldo según la opacidad. Las nuevas filas guardan URLs `https://images.frontbook.cl/...`; al borrar un diseño, se elimina el objeto R2 correspondiente. Las rutas históricas de Supabase siguen siendo compatibles mediante el resolvedor del catálogo, por lo que pedidos antiguos no cambian durante la transición.

Antes de sustituir las URLs históricas de la base de datos o borrar los 137 originales del bucket `catalog-designs`, se debe confirmar una subida real desde Administración y mantener el respaldo de Supabase durante al menos 7–14 días. Los archivos privados migran a `droska-customer-designs` en R2 mediante la función `private-design-storage`: el navegador optimiza el origen (máximo 12 MB) a WebP de hasta 3 MB y recibe una URL firmada de 60 segundos para una ruta que pertenece a su propia cuenta. R2 se mantiene privado y solo administración obtiene enlaces de lectura temporales.

## Optimización y compactación pendiente del catálogo existente

Los 137 objetos ya copiados en el bucket público no se sobrescribirán. La compactación debe crear rutas WebP nuevas, verificar tamaño, dimensiones y carga de cada una, cambiar referencias solamente después de aprobar la muestra y retener las rutas antiguas como rollback durante 14 días. Después de ese periodo se puede autorizar por separado el borrado de los originales de R2. Este procedimiento evita una pérdida irreversible si una ilustración pierde transparencia o detalle de impresión.

## Restricción actual

La copia no elimina el tráfico ya acumulado en Supabase y también implica lecturas del origen. El aviso mostrado vence el 18 de octubre; el ciclo mostrado se reinicia el 20. Resolver la continuidad del servicio separadamente antes de la fecha de restricción.

## Referencias

- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://supabase.com/docs/guides/platform/manage-your-usage/egress
