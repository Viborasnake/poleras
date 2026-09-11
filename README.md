# Polerama

Prototipo funcional de una tienda de poleras personalizadas, en español chileno. Nombre y subdominio propuestos: **Polerama**, `polerama.frontbook.cl` (sin configurar ni verificar disponibilidad de marca).

## Ejecutar

`npm install`, luego `npm run dev`. Para producción estática: `npm run build`; el resultado se genera en `dist/`.

## Implementado

- Portada adaptable, tres caminos creativos, explicación del proceso y preguntas frecuentes.
- Carga local de JPG/PNG/WEBP con validación de tipo, decodificación y límite de 10 MB.
- Poleras básica ($14.990), oversize ($21.990) y niños ($8.990), selección de talla y color.
- Modelo geométrico 3D giratorio con Three.js y aplicación de imagen frontal. Es una aproximación ilustrativa, no una simulación física del calce o impresión.
- Resumen de precio base y mitad correspondiente. Diseño y entrega pendientes de cotización; el abono definitivo se calcula sobre el total aprobado.
- Borrador local eliminable en navegador. El archivo de imagen no se almacena ni se envía. No se solicitan datos personales en esta demostración.

## Pendiente para operar comercialmente

Esta versión **no crea cuentas, no envía pedidos al taller y no procesa pagos**. La interfaz lo indica explícitamente.

Conectar autenticación, base de datos y almacenamiento privado; construir panel del taller para cotizar, subir propuestas y gestionar revisiones; configurar proveedor de pago y webhooks verificados para abono del 50% y saldo; envío de notificaciones; definir guía de tallas, disponibilidad, entrega y condiciones comerciales. Configurar hosting y DNS para el subdominio aprobado bajo frontbook.cl. No se ha publicado ni modificado DNS.

Flujo previsto: borrador → solicitud enviada → cotización aprobada → abono confirmado → diseño en trabajo → propuesta disponible → aprobación del cliente → saldo confirmado → impresión → entrega. Los importes y transiciones deben validarse en servidor; nunca confiar en localStorage o en importes enviados por el navegador.
