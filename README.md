# Tolska

Prototipo funcional de una tienda de poleras personalizadas, en español chileno. Marca: **Tolska**.

## Ejecutar

`npm install`, luego `npm run dev`. Para producción estática: `npm run build`; el resultado se genera en `dist/`.

## Implementado

- Portada adaptable, tres caminos creativos, explicación del proceso y preguntas frecuentes.
- Carga local de JPG/PNG/WEBP con validación de tipo, decodificación y límite de 50 MB.
- Poleras básica ($14.990), oversize ($21.990) y niños ($8.990), selección de talla y color.
- Modelo GLB de polera con pliegues, cuello, mangas y textura de tela; rotación manual con Three.js y estampado proyectado sobre la malla mediante DecalGeometry. Vista frontal inicial e iluminación mate. Es una referencia visual, no una simulación física del calce o impresión; oversize y niños son variaciones de escala del mismo modelo.
- Laika se carga como diseño de muestra por defecto (`public/laika.png`) para que el visor no abra vacío; al subir otro archivo se reemplaza y se ejecuta la validación técnica.
- Resumen de precio base y mitad correspondiente. Diseño y entrega pendientes de cotización; el abono definitivo se calcula sobre el total aprobado.
- Borrador local eliminable en navegador. El archivo de imagen no se almacena ni se envía. No se solicitan datos personales en esta demostración.
- Checkout visual de Mercado Pago en modo simulación para probar aprobación de cuota en “Mejorarlo” y “Desde cero”; no crea preferencias ni cobra.

## Pendiente para operar comercialmente

El recurso `public/shirt.glb` proviene del proyecto `Starklord17/threejs-t-shirt`; su licencia MIT y atribución se incluyen en `public/shirt-LICENSE.txt`.

Esta versión **no crea cuentas, no envía pedidos al taller y no procesa pagos**. La interfaz lo indica explícitamente.

Conectar autenticación, base de datos y almacenamiento privado; construir panel del taller para cotizar, subir propuestas y gestionar revisiones; configurar proveedor de pago y webhooks verificados para abono del 50% y saldo; envío de notificaciones; definir guía de tallas, disponibilidad, entrega y condiciones comerciales. Configurar hosting y DNS para `vantra.cl`. No se ha publicado ni modificado DNS.

Flujo previsto: borrador → solicitud enviada → cotización aprobada → abono confirmado → diseño en trabajo → propuesta disponible → aprobación del cliente → saldo confirmado → impresión → entrega. Los importes y transiciones deben validarse en servidor; nunca confiar en localStorage o en importes enviados por el navegador.
